using System.Security.Cryptography;
using System.Data.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record CreateCoachInvitationRequest(
    string Email,
    CoachingRole? Role = null,
    CoachingAccessLevel? AccessLevel = null,
    bool? IsPrimary = null,
    DateTimeOffset? AssignmentEndsAt = null,
    string? MovementScope = null);
public sealed record CoachInvitationResponse(Guid Id, string RecipientEmail, DateTimeOffset ExpiresAt, string AcceptanceUrl, bool RecipientHasAccount, bool EmailSent);
public sealed record CoachAthleteResponse(Guid AthleteProfileId, Guid UserId, string DisplayName, string Email);

[Authorize(Roles = "COACH")]
[ApiController]
[Route("api/coach")]
public sealed class CoachInvitationsController(
    TrainingDbContext database,
    IInvitationEmailService invitationEmailService,
    IConfiguration configuration,
    ILogger<CoachInvitationsController>? logger = null) : ControllerBase
{
    [HttpPost("athlete-invitations")]
    [EnableRateLimiting("invitations")]
    [ProducesResponseType(typeof(CoachInvitationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CoachInvitationResponse>> CreateInvitation([FromBody] CreateCoachInvitationRequest request, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@') || request.Email.Length > 320)
        {
            ModelState.AddModelError(nameof(request.Email), "Provide a valid athlete email address.");
            return ValidationProblem(ModelState);
        }
        if (string.Equals(request.Email.Trim(), User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value, StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError(nameof(request.Email), "You cannot invite your own account.");
            return ValidationProblem(ModelState);
        }
        if (request.AssignmentEndsAt <= DateTimeOffset.UtcNow)
        {
            ModelState.AddModelError(nameof(request.AssignmentEndsAt), "Temporary access must end in the future.");
        }
        if (request.MovementScope?.Length > 500)
        {
            ModelState.AddModelError(nameof(request.MovementScope), "Movement scope must be 500 characters or fewer.");
        }
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var coach = await database.PlatformUsers.SingleOrDefaultAsync(user => user.Id == coachId && user.CanCoach, cancellationToken);
        if (coach is null)
        {
            return Forbid();
        }

        var recipientEmail = request.Email.Trim().ToUpperInvariant();
        var role = request.Role ?? CoachingRole.Strength;
        var existingUser = await database.PlatformUsers.AsNoTracking()
            .SingleOrDefaultAsync(user => user.NormalizedEmail == recipientEmail
                || user.Email.ToUpper() == recipientEmail, cancellationToken);
        if (existingUser is not null && await database.CoachingAssignments.AsNoTracking().AnyAsync(assignment =>
            assignment.CoachId == coach.Id
            && assignment.AthleteUserId == existingUser.Id
            && assignment.Role == role
            && assignment.Status == CoachingAssignmentStatus.Active
            && (assignment.EndsAt == null || assignment.EndsAt > DateTimeOffset.UtcNow), cancellationToken))
        {
            ModelState.AddModelError(nameof(request.Email), "This user already has an active assignment with you for that coaching role.");
            return ValidationProblem(ModelState);
        }
        if (await database.CoachInvitations.AsNoTracking().AnyAsync(invitation =>
            invitation.CoachId == coach.Id
            && invitation.RecipientEmail == recipientEmail
            && invitation.Role == role
            && invitation.AcceptedAt == null
            && invitation.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken))
        {
            ModelState.AddModelError(nameof(request.Email), "An active invitation already exists for this email and coaching role.");
            return ValidationProblem(ModelState);
        }
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var invitation = new CoachInvitation
        {
            CoachId = coach.Id,
            RecipientEmail = recipientEmail,
            TokenHash = AuthenticationController.HashToken(rawToken),
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(48),
            Role = role,
            AccessLevel = request.AccessLevel ?? CoachingAccessLevel.Full,
            IsPrimary = request.IsPrimary ?? role == CoachingRole.Strength,
            AssignmentEndsAt = request.AssignmentEndsAt,
            MovementScope = string.IsNullOrWhiteSpace(request.MovementScope) ? null : request.MovementScope.Trim()
        };
        database.CoachInvitations.Add(invitation);
        await database.SaveChangesAsync(cancellationToken);

        var registrationBaseUrl = configuration["Client:RegistrationUrl"]
            ?? throw new InvalidOperationException("Client:RegistrationUrl is required.");
        var acceptanceBaseUrl = existingUser is null
            ? registrationBaseUrl
            : configuration["Client:InvitationUrl"] ?? ReplaceFinalPathSegment(registrationBaseUrl, "invitation");
        var acceptanceUrl = $"{acceptanceBaseUrl}?token={Uri.EscapeDataString(rawToken)}";
        var emailSent = await invitationEmailService.SendAsync(recipientEmail, coach.DisplayName, acceptanceUrl, cancellationToken);
        return Created($"/api/coach/athlete-invitations/{invitation.Id}", new CoachInvitationResponse(invitation.Id, recipientEmail, invitation.ExpiresAt, acceptanceUrl, existingUser is not null, emailSent));
    }

    private static string ReplaceFinalPathSegment(string url, string segment)
    {
        var uri = new Uri(url);
        var builder = new UriBuilder(uri) { Path = $"/{segment}", Query = string.Empty };
        return builder.Uri.ToString().TrimEnd('/');
    }

    [HttpGet("athletes")]
    [ProducesResponseType(typeof(IReadOnlyList<CoachAthleteResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CoachAthleteResponse>>> GetAthletes(CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }

        try
        {
            var now = DateTimeOffset.UtcNow;
            var linkedUsers = await database.CoachingAssignments.AsNoTracking()
                .Where(assignment => assignment.CoachId == coachId &&
                    assignment.Status == CoachingAssignmentStatus.Active &&
                    assignment.AccessLevel >= CoachingAccessLevel.ReadOnly &&
                    (assignment.EndsAt == null || assignment.EndsAt > now))
                .Select(assignment => assignment.AthleteUser!)
                .Distinct()
                .Select(user => new { user.Id, user.DisplayName, user.Email })
                .OrderBy(user => user.DisplayName)
                .ToListAsync(cancellationToken);
            if (linkedUsers.Count == 0)
            {
                logger?.LogInformation("Loaded zero athletes for coach {CoachId}", coachId);
                return Ok(Array.Empty<CoachAthleteResponse>());
            }

            var userIds = linkedUsers.Select(user => user.Id).ToHashSet();
            var profiles = await database.AthleteProfiles.AsNoTracking()
                .Where(profile => profile.PlatformUserId.HasValue && userIds.Contains(profile.PlatformUserId.Value))
                .Select(profile => new { profile.Id, profile.PlatformUserId })
                .ToListAsync(cancellationToken);
            var profileByUserId = profiles
                .Where(profile => profile.PlatformUserId.HasValue)
                .ToDictionary(profile => profile.PlatformUserId!.Value, profile => profile.Id);
            var athletes = linkedUsers
                .Where(user => profileByUserId.ContainsKey(user.Id))
                .Select(user => new CoachAthleteResponse(profileByUserId[user.Id], user.Id, user.DisplayName, user.Email))
                .ToList();
            logger?.LogInformation("Loaded {AthleteCount} athletes for coach {CoachId}", athletes.Count, coachId);
            return Ok(athletes);
        }
        catch (DbException exception)
        {
            logger?.LogError(exception, "Could not load athletes for coach {CoachId}", coachId);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "The athlete roster is temporarily unavailable.",
                Detail = "The API could not read the coaching database. Start PostgreSQL and restart the API before trying again."
            });
        }
    }
}