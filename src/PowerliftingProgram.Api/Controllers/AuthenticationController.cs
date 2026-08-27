using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record RegisterRequest(string DisplayName, string Email, string Password, PlatformRole Role, string? InvitationToken);
public sealed record LoginRequest(string Email, string Password);
public sealed record AccountResponse(Guid Id, string DisplayName, string Email, PlatformRole Role, Guid? CoachId, Guid? AthleteProfileId);
public sealed record SessionResponse(string AccessToken, AccountResponse Account);
public sealed record InvitationContextResponse(string CoachName, string RecipientEmail, DateTimeOffset ExpiresAt);

[ApiController]
[Route("api/auth")]
public sealed class AuthenticationController(
    TrainingDbContext database,
    PasswordHashingService passwordHashingService,
    JwtTokenService jwtTokenService) : ControllerBase
{
    [AllowAnonymous]
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
    [HttpPost("login")]
    [ProducesResponseType(typeof(SessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SessionResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(request.Email);
        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile)
            .SingleOrDefaultAsync(candidate => candidate.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null || !passwordHashingService.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new ProblemDetails { Title = "Email or password is incorrect." });
        }

        return Ok(new SessionResponse(jwtTokenService.Create(user), ToAccountResponse(user, user.AthleteProfile?.Id)));
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
    }

    private static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    internal static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static AccountResponse ToAccountResponse(PlatformUser user, Guid? athleteProfileId) =>
        new(user.Id, user.DisplayName, user.Email, user.Role, user.CoachId, athleteProfileId);
}