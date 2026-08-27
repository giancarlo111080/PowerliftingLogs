using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record CreateCoachInvitationRequest(string Email);
public sealed record CoachInvitationResponse(Guid Id, string RecipientEmail, DateTimeOffset ExpiresAt, string RegistrationUrl);
public sealed record CoachAthleteResponse(Guid AthleteProfileId, Guid UserId, string DisplayName, string Email);

[Authorize(Roles = "COACH")]
[ApiController]
[Route("api/coach")]
public sealed class CoachInvitationsController(
    TrainingDbContext database,
    IInvitationEmailService invitationEmailService,
    IConfiguration configuration) : ControllerBase
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

        var coach = await database.PlatformUsers.SingleOrDefaultAsync(user => user.Id == coachId && user.Role == PlatformRole.Coach, cancellationToken);
        if (coach is null)
        {
            return Forbid();
        }

        var recipientEmail = request.Email.Trim().ToUpperInvariant();
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var invitation = new CoachInvitation
        {
            CoachId = coach.Id,
            RecipientEmail = recipientEmail,
            TokenHash = AuthenticationController.HashToken(rawToken),
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(48)
        };
        database.CoachInvitations.Add(invitation);
        await database.SaveChangesAsync(cancellationToken);

        var registrationBaseUrl = configuration["Client:RegistrationUrl"] ?? throw new InvalidOperationException("Client:RegistrationUrl is required.");
        var registrationUrl = $"{registrationBaseUrl}?token={Uri.EscapeDataString(rawToken)}";
        await invitationEmailService.SendAsync(recipientEmail, coach.DisplayName, registrationUrl, cancellationToken);
        return Created($"/api/coach/athlete-invitations/{invitation.Id}", new CoachInvitationResponse(invitation.Id, recipientEmail, invitation.ExpiresAt, registrationUrl));
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

        var athletes = await database.PlatformUsers.AsNoTracking()
            .Where(user => user.Role == PlatformRole.Athlete && user.CoachId == coachId)
            .Select(user => new CoachAthleteResponse(user.AthleteProfile!.Id, user.Id, user.DisplayName, user.Email))
            .OrderBy(user => user.DisplayName)
            .ToListAsync(cancellationToken);
        return Ok(athletes);
    }
}