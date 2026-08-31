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

public sealed record RegisterRequest(string DisplayName, string Email, string Password, string CountryCode, PlatformRole Role, string? InvitationToken, DateOnly? DateOfBirth = null, AthleteSex? Sex = null, decimal? BodyWeightKg = null, PowerliftingExperience? Experience = null, PowerliftingEquipment? Equipment = null, string FederationCode = "IPF");
public sealed record LoginRequest(string Email, string Password, string? InvitationToken = null);
public sealed record RequestPasswordResetRequest(string Email);
public sealed record CompletePasswordResetRequest(string Token, string Password);
public sealed record PasswordResetRequestedResponse(string Message, string? ResetUrl = null);
public sealed record UpdateProfileRequest(string DisplayName, string? CountryCode, decimal? BodyWeightKg, string? CompetitionWeightClass, decimal? SquatOneRepMaxKg, decimal? BenchOneRepMaxKg, decimal? DeadliftOneRepMaxKg, string? UpcomingMeet, DateOnly? DateOfBirth = null, AthleteSex? Sex = null, PowerliftingExperience? Experience = null, PowerliftingEquipment? Equipment = null, string? FederationCode = null, string? CompetitionAgeDivision = null);
public sealed record AccountResponse(Guid Id, string DisplayName, string Email, string? CountryCode, PlatformRole Role, bool CanCoach, bool CanTrain, Guid? CoachId, string? CoachName, Guid? AthleteProfileId, decimal? BodyWeightKg, string? CompetitionWeightClass, decimal? SquatOneRepMaxKg, decimal? BenchOneRepMaxKg, decimal? DeadliftOneRepMaxKg, string? UpcomingMeet, DateOnly? DateOfBirth, AthleteSex? Sex, PowerliftingExperience? Experience, PowerliftingEquipment? Equipment, string? FederationCode, string? CompetitionAgeDivision);
public sealed record SessionResponse(string AccessToken, AccountResponse Account);
public sealed record InvitationContextResponse(string CoachName, string RecipientEmail, DateTimeOffset ExpiresAt, bool ExistingAccount, CoachingRole Role, CoachingAccessLevel AccessLevel, bool IsPrimary);

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
            CanCoach = request.Role == PlatformRole.Coach,
            CoachId = invitation?.CoachId
        };
        database.PlatformUsers.Add(user);

        var athleteProfile = new AthleteProfile
        {
            PlatformUserId = user.Id,
            ExternalUserId = $"platform-{user.Id}",
            DisplayName = user.DisplayName,
            CountryCode = request.CountryCode.Trim().ToUpperInvariant(),
            Sex = request.Sex ?? AthleteSex.PreferNotToSay,
            DateOfBirth = request.DateOfBirth,
            Experience = request.Experience ?? PowerliftingExperience.Novice,
            Equipment = request.Equipment ?? PowerliftingEquipment.Classic,
            FederationCode = request.FederationCode.Trim().ToUpperInvariant(),
            CompetitionAgeDivision = request.DateOfBirth is null ? "Open" : IpfClassification.AgeDivision(request.DateOfBirth.Value, DateOnly.FromDateTime(DateTime.UtcNow)),
            BodyWeightKg = request.BodyWeightKg ?? 0,
            CompetitionWeightClass = request.Sex is AthleteSex.Female or AthleteSex.Male && request.BodyWeightKg > 0
                ? IpfClassification.WeightClass(request.Sex.Value, request.BodyWeightKg.Value, request.DateOfBirth is not null && IpfClassification.IsYouthDivision(request.DateOfBirth.Value, DateOnly.FromDateTime(DateTime.UtcNow)))
                : "Unspecified"
        };
        user.AthleteProfile = athleteProfile;
        database.AthleteProfiles.Add(athleteProfile);

        if (invitation is not null)
        {
            database.CoachingAssignments.Add(CreateAssignment(invitation, user.Id));
            user.Coach = invitation.Coach;
            invitation.AcceptedAt = DateTimeOffset.UtcNow;
            invitation.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await database.SaveChangesAsync(cancellationToken);
        var account = ToAccountResponse(user, athleteProfile?.Id,
            user.Role == PlatformRole.Athlete || invitation?.AccessLevel >= CoachingAccessLevel.Program);
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
        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile).Include(candidate => candidate.Coach)
            .SingleOrDefaultAsync(candidate => candidate.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null || !passwordHashingService.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new ProblemDetails { Title = "Email or password is incorrect." });
        }

        if (!string.IsNullOrWhiteSpace(request.InvitationToken))
        {
            var invitation = await database.CoachInvitations.Include(item => item.Coach)
                .SingleOrDefaultAsync(item => item.TokenHash == HashToken(request.InvitationToken), cancellationToken);
            if (invitation is null || invitation.AcceptedAt is not null || invitation.ExpiresAt <= DateTimeOffset.UtcNow ||
                !string.Equals(invitation.RecipientEmail, user.NormalizedEmail, StringComparison.OrdinalIgnoreCase))
            {
                ModelState.AddModelError(nameof(request.InvitationToken), "This coach invitation is invalid or has expired.");
                return ValidationProblem(ModelState);
            }
            if (invitation.CoachId == user.Id)
            {
                ModelState.AddModelError(nameof(request.InvitationToken), "An account cannot coach itself.");
                return ValidationProblem(ModelState);
            }
            var changedAt = DateTimeOffset.UtcNow;
            var currentPrimaryAssignments = await database.CoachingAssignments
                .Where(assignment => assignment.AthleteUserId == user.Id &&
                    assignment.Role == invitation.Role && invitation.IsPrimary && assignment.IsPrimary &&
                    assignment.Status == CoachingAssignmentStatus.Active)
                .ToListAsync(cancellationToken);
            foreach (var assignment in currentPrimaryAssignments)
            {
                assignment.Status = CoachingAssignmentStatus.Completed;
                assignment.EndsAt = changedAt;
                assignment.UpdatedAt = changedAt;
            }
            database.CoachingAssignments.Add(CreateAssignment(invitation, user.Id, changedAt));
            if (invitation.Role == CoachingRole.Strength && invitation.IsPrimary)
            {
                user.CoachId = invitation.CoachId;
                user.Coach = invitation.Coach;
            }
            user.UpdatedAt = changedAt;
            invitation.AcceptedAt = changedAt;
            invitation.UpdatedAt = changedAt;
            await database.SaveChangesAsync(cancellationToken);
        }

        return Ok(new SessionResponse(jwtTokenService.Create(user), ToAccountResponse(user, user.AthleteProfile?.Id, await CanTrainAsync(user, cancellationToken))));
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

        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile).Include(candidate => candidate.Coach)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        return user is null ? Unauthorized() : Ok(ToAccountResponse(user, user.AthleteProfile?.Id, await CanTrainAsync(user, cancellationToken)));
    }

    [Authorize]
    [HttpPatch("me")]
    [ProducesResponseType(typeof(AccountResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AccountResponse>> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile).Include(candidate => candidate.Coach)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        var displayName = request.DisplayName.Trim();
        if (displayName.Length is 0 or > 120)
        {
            ModelState.AddModelError(nameof(request.DisplayName), "Display name is required and must be 120 characters or fewer.");
            return ValidationProblem(ModelState);
        }

        user.DisplayName = displayName;
        if (user.AthleteProfile is not null)
        {
            var profile = user.AthleteProfile;
            var federationCode = request.FederationCode?.Trim().ToUpperInvariant() ?? profile.FederationCode;
            var ageDivision = request.CompetitionAgeDivision?.Trim() ?? profile.CompetitionAgeDivision;
            var weightClass = request.CompetitionWeightClass?.Trim() ?? profile.CompetitionWeightClass;
            if (!string.Equals(federationCode, "IPF", StringComparison.OrdinalIgnoreCase))
                ModelState.AddModelError(nameof(request.FederationCode), "Profile classification currently supports the IPF ruleset.");
            if (!IpfClassification.IsEligibleAgeDivision(request.DateOfBirth ?? profile.DateOfBirth, ageDivision))
                ModelState.AddModelError(nameof(request.CompetitionAgeDivision), "The selected age category is not available for this date of birth.");
            if (!IpfClassification.IsWeightClass(request.Sex ?? profile.Sex, ageDivision, weightClass))
                ModelState.AddModelError(nameof(request.CompetitionWeightClass), "Select a valid IPF weight class for this category.");
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            profile.DisplayName = displayName;
            profile.CountryCode = string.IsNullOrWhiteSpace(request.CountryCode) ? null : request.CountryCode.Trim().ToUpperInvariant();
            profile.BodyWeightKg = request.BodyWeightKg ?? profile.BodyWeightKg;
            profile.DateOfBirth = request.DateOfBirth ?? profile.DateOfBirth;
            profile.Sex = request.Sex ?? profile.Sex;
            profile.Experience = request.Experience ?? profile.Experience;
            profile.Equipment = request.Equipment ?? profile.Equipment;
            profile.FederationCode = federationCode;
            profile.CompetitionAgeDivision = ageDivision;
            profile.CompetitionWeightClass = weightClass;
            profile.SquatOneRepMaxKg = request.SquatOneRepMaxKg ?? profile.SquatOneRepMaxKg;
            profile.BenchOneRepMaxKg = request.BenchOneRepMaxKg ?? profile.BenchOneRepMaxKg;
            profile.DeadliftOneRepMaxKg = request.DeadliftOneRepMaxKg ?? profile.DeadliftOneRepMaxKg;
            profile.UpcomingMeetIdentifier = string.IsNullOrWhiteSpace(request.UpcomingMeet) ? null : request.UpcomingMeet.Trim();
            profile.UpdatedAt = DateTimeOffset.UtcNow;
        }
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await database.SaveChangesAsync(cancellationToken);

        return Ok(ToAccountResponse(user, user.AthleteProfile?.Id, await CanTrainAsync(user, cancellationToken)));
    }

    [Authorize]
    [HttpDelete("coach")]
    [ProducesResponseType(typeof(AccountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AccountResponse>> LeaveCoach(CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        var changedAt = DateTimeOffset.UtcNow;
        var activePrimaryAssignments = await database.CoachingAssignments
            .Where(assignment => assignment.AthleteUserId == user.Id && assignment.CoachId == user.CoachId &&
                assignment.Role == CoachingRole.Strength && assignment.IsPrimary &&
                assignment.Status == CoachingAssignmentStatus.Active)
            .ToListAsync(cancellationToken);
        foreach (var assignment in activePrimaryAssignments)
        {
            assignment.Status = CoachingAssignmentStatus.Revoked;
            assignment.EndsAt = changedAt;
            assignment.UpdatedAt = changedAt;
        }
        user.CoachId = null;
        user.UpdatedAt = changedAt;
        await database.SaveChangesAsync(cancellationToken);
        return Ok(ToAccountResponse(user, user.AthleteProfile?.Id, await CanTrainAsync(user, cancellationToken)));
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

        var normalizedRecipientEmail = NormalizeEmail(invitation.RecipientEmail);
        var existingAccount = await database.PlatformUsers.AsNoTracking()
            .AnyAsync(user => user.NormalizedEmail == normalizedRecipientEmail
                || user.Email.ToUpper() == normalizedRecipientEmail, cancellationToken);
        return Ok(new InvitationContextResponse(
            invitation.Coach.DisplayName,
            invitation.RecipientEmail,
            invitation.ExpiresAt,
            existingAccount,
            invitation.Role,
            invitation.AccessLevel,
            invitation.IsPrimary));
    }

    [Authorize]
    [HttpPost("invitations/{token}/accept")]
    [ProducesResponseType(typeof(AccountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AccountResponse>> AcceptInvitation(string token, CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await database.PlatformUsers.Include(candidate => candidate.AthleteProfile).Include(candidate => candidate.Coach)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        var error = await ApplyInvitationAsync(user, token, cancellationToken);
        if (error is not null)
        {
            ModelState.AddModelError(nameof(token), error);
            return ValidationProblem(ModelState);
        }

        return Ok(ToAccountResponse(user, user.AthleteProfile?.Id, await CanTrainAsync(user, cancellationToken)));
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
        var countryCode = request.CountryCode?.Trim();
        if (countryCode is null || countryCode.Length != 2 || !countryCode.All(char.IsLetter))
        {
            ModelState.AddModelError(nameof(request.CountryCode), "Country code must be a two-letter ISO 3166-1 alpha-2 code.");
        }
        if (!Enum.IsDefined(request.Role))
        {
            ModelState.AddModelError(nameof(request.Role), "Select a valid account role.");
        }
        if (request.Role == PlatformRole.Athlete)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (request.DateOfBirth is null || request.DateOfBirth > today.AddYears(-14) || request.DateOfBirth < today.AddYears(-120))
                ModelState.AddModelError(nameof(request.DateOfBirth), "Enter a valid date of birth. IPF classification begins in the calendar year the athlete turns 14.");
            if (request.Sex is not AthleteSex.Female and not AthleteSex.Male)
                ModelState.AddModelError(nameof(request.Sex), "Select the female or male IPF bodyweight classification.");
            if (request.BodyWeightKg is null or <= 20 or > 500)
                ModelState.AddModelError(nameof(request.BodyWeightKg), "Body weight must be between 20 and 500 kg.");
            if (request.Experience is null || !Enum.IsDefined(request.Experience.Value))
                ModelState.AddModelError(nameof(request.Experience), "Select your competition experience.");
            if (request.Equipment is null || !Enum.IsDefined(request.Equipment.Value))
                ModelState.AddModelError(nameof(request.Equipment), "Select Classic or Equipped powerlifting.");
            if (!string.Equals(request.FederationCode?.Trim(), "IPF", StringComparison.OrdinalIgnoreCase))
                ModelState.AddModelError(nameof(request.FederationCode), "Registration classification currently supports the IPF ruleset.");
        }
        if (request.InvitationToken?.Length > 128)
        {
            ModelState.AddModelError(nameof(request.InvitationToken), "Invitation token is invalid.");
        }
    }

    private static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    private async Task<string?> ApplyInvitationAsync(PlatformUser user, string token, CancellationToken cancellationToken)
    {
        var invitation = await database.CoachInvitations.Include(item => item.Coach)
            .SingleOrDefaultAsync(item => item.TokenHash == HashToken(token), cancellationToken);
        if (invitation is null || invitation.AcceptedAt is not null || invitation.ExpiresAt <= DateTimeOffset.UtcNow ||
            !string.Equals(NormalizeEmail(invitation.RecipientEmail), NormalizeEmail(user.Email), StringComparison.Ordinal))
        {
            return "This coach invitation is invalid or has expired.";
        }
        if (invitation.CoachId == user.Id)
        {
            return "An account cannot coach itself.";
        }

        var changedAt = DateTimeOffset.UtcNow;
        var currentPrimaryAssignments = await database.CoachingAssignments
            .Where(assignment => assignment.AthleteUserId == user.Id &&
                assignment.Role == invitation.Role && invitation.IsPrimary && assignment.IsPrimary &&
                assignment.Status == CoachingAssignmentStatus.Active)
            .ToListAsync(cancellationToken);
        foreach (var assignment in currentPrimaryAssignments)
        {
            assignment.Status = CoachingAssignmentStatus.Completed;
            assignment.EndsAt = changedAt;
            assignment.UpdatedAt = changedAt;
        }
        database.CoachingAssignments.Add(CreateAssignment(invitation, user.Id, changedAt));
        if (invitation.Role == CoachingRole.Strength && invitation.IsPrimary)
        {
            user.CoachId = invitation.CoachId;
            user.Coach = invitation.Coach;
        }
        user.UpdatedAt = changedAt;
        invitation.AcceptedAt = changedAt;
        invitation.UpdatedAt = changedAt;
        await database.SaveChangesAsync(cancellationToken);
        return null;
    }

    private static CoachingAssignment CreateAssignment(CoachInvitation invitation, Guid athleteUserId, DateTimeOffset? startsAt = null) => new()
    {
        CoachId = invitation.CoachId,
        AthleteUserId = athleteUserId,
        Role = invitation.Role,
        AccessLevel = invitation.AccessLevel,
        Status = CoachingAssignmentStatus.Active,
        IsPrimary = invitation.IsPrimary,
        StartsAt = startsAt ?? DateTimeOffset.UtcNow,
        EndsAt = invitation.AssignmentEndsAt,
        MovementScope = invitation.MovementScope
    };

    internal static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private async Task<bool> CanTrainAsync(PlatformUser user, CancellationToken cancellationToken)
    {
        if (user.Role == PlatformRole.Athlete)
        {
            return true;
        }

        var now = DateTimeOffset.UtcNow;
        return await database.CoachingAssignments.AsNoTracking().AnyAsync(assignment =>
            assignment.AthleteUserId == user.Id &&
            assignment.Status == CoachingAssignmentStatus.Active &&
            assignment.AccessLevel >= CoachingAccessLevel.Program &&
            (assignment.EndsAt == null || assignment.EndsAt > now), cancellationToken);
    }

    private static AccountResponse ToAccountResponse(PlatformUser user, Guid? athleteProfileId, bool canTrain) =>
        new(user.Id, user.DisplayName, user.Email, user.AthleteProfile?.CountryCode, user.Role, user.CanCoach, canTrain, user.CoachId, user.Coach?.DisplayName, athleteProfileId,
            user.AthleteProfile?.BodyWeightKg, user.AthleteProfile?.CompetitionWeightClass, user.AthleteProfile?.SquatOneRepMaxKg,
            user.AthleteProfile?.BenchOneRepMaxKg, user.AthleteProfile?.DeadliftOneRepMaxKg, user.AthleteProfile?.UpcomingMeetIdentifier,
            user.AthleteProfile?.DateOfBirth, user.AthleteProfile?.Sex, user.AthleteProfile?.Experience, user.AthleteProfile?.Equipment,
            user.AthleteProfile?.FederationCode, user.AthleteProfile?.CompetitionAgeDivision);
}

internal static class IpfClassification
{
    private static readonly string[] AgeDivisions = ["Sub-Junior", "Junior", "Open", "Master I", "Master II", "Master III", "Master IV"];

    public static string AgeDivision(DateOnly birthDate, DateOnly competitionDate)
    {
        var calendarAge = competitionDate.Year - birthDate.Year;
        return calendarAge switch { <= 18 => "Sub-Junior", <= 23 => "Junior", >= 70 => "Master IV", >= 60 => "Master III", >= 50 => "Master II", >= 40 => "Master I", _ => "Open" };
    }

    public static bool IsYouthDivision(DateOnly birthDate, DateOnly competitionDate) => competitionDate.Year - birthDate.Year <= 23;

    public static bool IsEligibleAgeDivision(DateOnly? birthDate, string division)
    {
        if (birthDate is null || !AgeDivisions.Contains(division)) return false;
        var derived = AgeDivision(birthDate.Value, DateOnly.FromDateTime(DateTime.UtcNow));
        return division == "Open" || division == derived;
    }

    public static bool IsWeightClass(AthleteSex sex, string division, string weightClass)
    {
        if (sex is not AthleteSex.Female and not AthleteSex.Male) return false;
        var youth = division is "Sub-Junior" or "Junior";
        var limits = sex == AthleteSex.Female
            ? youth ? new[] { "43", "47", "52", "57", "63", "69", "76", "84", "84+" } : new[] { "47", "52", "57", "63", "69", "76", "84", "84+" }
            : youth ? new[] { "53", "59", "66", "74", "83", "93", "105", "120", "120+" } : new[] { "59", "66", "74", "83", "93", "105", "120", "120+" };
        return limits.Contains(weightClass);
    }

    public static string WeightClass(AthleteSex sex, decimal bodyWeightKg, bool youthDivision)
    {
        var limits = sex == AthleteSex.Female
            ? youthDivision ? new decimal[] { 43, 47, 52, 57, 63, 69, 76, 84 } : new decimal[] { 47, 52, 57, 63, 69, 76, 84 }
            : youthDivision ? new decimal[] { 53, 59, 66, 74, 83, 93, 105, 120 } : new decimal[] { 59, 66, 74, 83, 93, 105, 120 };
        var limit = limits.FirstOrDefault(item => bodyWeightKg <= item);
        return limit > 0 ? limit.ToString("0") : $"{limits[^1]:0}+";
    }
}