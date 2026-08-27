using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record RegisterRequest(string DisplayName, string Email, string Password, PlatformRole Role, string? InvitationToken);
public sealed record LoginRequest(string Email, string Password);
public sealed record RequestPasswordResetRequest(string Email);
public sealed record CompletePasswordResetRequest(string Token, string Password);
public sealed record PasswordResetRequestedResponse(string Message, string? ResetUrl = null);
public sealed record AccountResponse(Guid Id, string DisplayName, string Email, PlatformRole Role, Guid? CoachId, Guid? AthleteProfileId);
public sealed record SessionResponse(string AccessToken, AccountResponse Account);
public sealed record InvitationContextResponse(string CoachName, string RecipientEmail, DateTimeOffset ExpiresAt);

[ApiController]
[Route("api/auth")]
public sealed class AuthenticationController(
    TrainingDbContext database,
    PasswordHashingService passwordHashingService,
    JwtTokenService jwtTokenService,
    IPasswordResetEmailService passwordResetEmailService,
    IConfiguration configuration) : ControllerBase
{
    private const string PasswordResetRequestedMessage = "If an account exists for that email address, a password reset link has been sent.";
    private const string LocalPasswordResetRequestedMessage = "If an account exists for that email address, use the one-hour reset link below.";

    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    [HttpPost("register")]
    [ProducesResponseType(typeof(SessionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SessionResponse>> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        ValidateRegistrationRequest(request);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        if (await database.PlatformUsers.AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            return Conflict(new ProblemDetails { Title = "An account already exists for this email address." });
        }

        CoachInvitation? invitation = null;
        if (!string.IsNullOrWhiteSpace(request.InvitationToken))
        {
            invitation = await database.CoachInvitations.Include(item => item.Coach)
                .SingleOrDefaultAsync(item => item.TokenHash == HashToken(request.InvitationToken), cancellationToken);
            if (invitation is null || invitation.AcceptedAt is not null || invitation.ExpiresAt <= DateTimeOffset.UtcNow)
            {
                ModelState.AddModelError(nameof(request.InvitationToken), "This coach invitation is invalid or has expired.");
            }
            else if (!string.Equals(invitation.RecipientEmail, normalizedEmail, StringComparison.OrdinalIgnoreCase))
            {
                ModelState.AddModelError(nameof(request.Email), "Register with the email address that received this invitation.");
            }
            else if (request.Role != PlatformRole.Athlete)
            {
                ModelState.AddModelError(nameof(request.Role), "Coach invitations can only create athlete accounts.");
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }
        }

        var user = new PlatformUser
        {
            Email = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = passwordHashingService.Hash(request.Password),
            Role = invitation is null ? request.Role : PlatformRole.Athlete,
            CoachId = invitation?.CoachId
        };
        database.PlatformUsers.Add(user);

        AthleteProfile? athleteProfile = null;
        if (user.Role == PlatformRole.Athlete)
        {
            athleteProfile = new AthleteProfile
            {
                PlatformUserId = user.Id,
                ExternalUserId = $"platform-{user.Id}",
                DisplayName = user.DisplayName,
                Sex = AthleteSex.PreferNotToSay,
                CompetitionWeightClass = "Unspecified"
            };
            database.AthleteProfiles.Add(athleteProfile);
        }

        if (invitation is not null)
        {
            invitation.AcceptedAt = DateTimeOffset.UtcNow;
            invitation.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await database.SaveChangesAsync(cancellationToken);
        var account = ToAccountResponse(user, athleteProfile?.Id);
        return CreatedAtAction(nameof(Me), new SessionResponse(jwtTokenService.Create(user), account));
    }

    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    [HttpPost("login")]
    [ProducesResponseType(typeof(SessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SessionResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@') || request.Email.Length > 320)
        {
            ModelState.AddModelError(nameof(request.Email), "Provide a valid email address.");
        }
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
        {
            ModelState.AddModelError(nameof(request.Password), "Password is required and must be 128 characters or fewer.");
        }
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile)
            .SingleOrDefaultAsync(candidate => candidate.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null || !passwordHashingService.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new ProblemDetails { Title = "Email or password is incorrect." });
        }

        return Ok(new SessionResponse(jwtTokenService.Create(user), ToAccountResponse(user, user.AthleteProfile?.Id)));
    }

    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    [HttpPost("password-reset/request")]
    [ProducesResponseType(typeof(PasswordResetRequestedResponse), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PasswordResetRequestedResponse>> RequestPasswordReset(
        [FromBody] RequestPasswordResetRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@') || request.Email.Length > 320)
        {
            ModelState.AddModelError(nameof(request.Email), "Provide a valid email address.");
            return ValidationProblem(ModelState);
        }

        var exposeResetLink = configuration.GetValue<bool>("Authentication:ExposePasswordResetLink");
        string? exposedResetUrl = null;
        var user = await database.PlatformUsers.SingleOrDefaultAsync(
            candidate => candidate.NormalizedEmail == NormalizeEmail(request.Email),
            cancellationToken);
        if (user is not null)
        {
            var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            user.PasswordResetTokenHash = HashToken(rawToken);
            user.PasswordResetExpiresAt = DateTimeOffset.UtcNow.AddHours(1);
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await database.SaveChangesAsync(cancellationToken);

            var resetBaseUrl = configuration["Client:PasswordResetUrl"]
                ?? throw new InvalidOperationException("Client:PasswordResetUrl is required.");
            var resetUrl = $"{resetBaseUrl}?token={Uri.EscapeDataString(rawToken)}";
            if (exposeResetLink)
            {
                exposedResetUrl = resetUrl;
            }
            else
            {
                await passwordResetEmailService.SendAsync(user.Email, user.DisplayName, resetUrl, cancellationToken);
            }
        }

        return Accepted(new PasswordResetRequestedResponse(
            exposeResetLink ? LocalPasswordResetRequestedMessage : PasswordResetRequestedMessage,
            exposedResetUrl));
    }

    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    [HttpPost("password-reset/complete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CompletePasswordReset(
        [FromBody] CompletePasswordResetRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || request.Token.Length > 128)
        {
            ModelState.AddModelError(nameof(request.Token), "This password reset link is invalid or has expired.");
        }
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12 || request.Password.Length > 128)
        {
            ModelState.AddModelError(nameof(request.Password), "Password must contain between 12 and 128 characters.");
        }
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var tokenHash = HashToken(request.Token);
        var user = await database.PlatformUsers.SingleOrDefaultAsync(
            candidate => candidate.PasswordResetTokenHash == tokenHash && candidate.PasswordResetExpiresAt > DateTimeOffset.UtcNow,
            cancellationToken);
        if (user is null)
        {
            ModelState.AddModelError(nameof(request.Token), "This password reset link is invalid or has expired.");
            return ValidationProblem(ModelState);
        }

        user.PasswordHash = passwordHashingService.Hash(request.Password);
        user.PasswordResetTokenHash = null;
        user.PasswordResetExpiresAt = null;
        user.SessionVersion += 1;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(nameof(request.Token), "This password reset link is invalid or has expired.");
            return ValidationProblem(ModelState);
        }

        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(AccountResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AccountResponse>> Me(CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        return user is null ? Unauthorized() : Ok(ToAccountResponse(user, user.AthleteProfile?.Id));
    }

    [AllowAnonymous]
    [HttpGet("invitations/{token}")]
    [ProducesResponseType(typeof(InvitationContextResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InvitationContextResponse>> InvitationContext(string token, CancellationToken cancellationToken)
    {
        var invitation = await database.CoachInvitations.AsNoTracking().Include(item => item.Coach)
            .SingleOrDefaultAsync(item => item.TokenHash == HashToken(token) && item.AcceptedAt == null && item.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken);
        if (invitation?.Coach is null)
        {
            return NotFound();
        }

        return Ok(new InvitationContextResponse(invitation.Coach.DisplayName, invitation.RecipientEmail, invitation.ExpiresAt));
    }

    private void ValidateRegistrationRequest(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 120)
        {
            ModelState.AddModelError(nameof(request.DisplayName), "Display name is required and must be 120 characters or fewer.");
        }
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@') || request.Email.Length > 320)
        {
            ModelState.AddModelError(nameof(request.Email), "Provide a valid email address.");
        }
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12)
        {
            ModelState.AddModelError(nameof(request.Password), "Password must contain at least 12 characters.");
        }
        else if (request.Password.Length > 128)
        {
            ModelState.AddModelError(nameof(request.Password), "Password must contain at most 128 characters.");
        }
        if (!Enum.IsDefined(request.Role))
        {
            ModelState.AddModelError(nameof(request.Role), "Select a valid account role.");
        }
        if (request.InvitationToken?.Length > 128)
        {
            ModelState.AddModelError(nameof(request.InvitationToken), "Invitation token is invalid.");
        }
    }

    private static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    internal static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static AccountResponse ToAccountResponse(PlatformUser user, Guid? athleteProfileId) =>
        new(user.Id, user.DisplayName, user.Email, user.Role, user.CoachId, athleteProfileId);
}