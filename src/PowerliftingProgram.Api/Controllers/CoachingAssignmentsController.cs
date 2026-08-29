using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record CoachingAssignmentResponse(
    Guid Id,
    Guid CoachId,
    string CoachName,
    Guid AthleteUserId,
    string AthleteName,
    CoachingRole Role,
    CoachingAccessLevel AccessLevel,
    CoachingAssignmentStatus Status,
    bool IsPrimary,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    string? MovementScope);

[Authorize]
[ApiController]
[Route("api/coaching-assignments")]
public sealed class CoachingAssignmentsController(TrainingDbContext database) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CoachingAssignmentResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CoachingAssignmentResponse>>> List(CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var assignments = await database.CoachingAssignments.AsNoTracking()
            .Where(assignment => assignment.AthleteUserId == userId || assignment.CoachId == userId)
            .OrderByDescending(assignment => assignment.Status == CoachingAssignmentStatus.Active)
            .ThenByDescending(assignment => assignment.StartsAt)
            .Select(assignment => new CoachingAssignmentResponse(
                assignment.Id,
                assignment.CoachId,
                assignment.Coach!.DisplayName,
                assignment.AthleteUserId,
                assignment.AthleteUser!.DisplayName,
                assignment.Role,
                assignment.AccessLevel,
                assignment.Status,
                assignment.IsPrimary,
                assignment.StartsAt,
                assignment.EndsAt,
                assignment.MovementScope))
            .ToListAsync(cancellationToken);
        return Ok(assignments);
    }

    [HttpDelete("{assignmentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Revoke(Guid assignmentId, CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var assignment = await database.CoachingAssignments
            .SingleOrDefaultAsync(candidate => candidate.Id == assignmentId, cancellationToken);
        if (assignment is null)
        {
            return NotFound();
        }
        if (assignment.AthleteUserId != userId && assignment.CoachId != userId)
        {
            return Forbid();
        }
        if (assignment.Status != CoachingAssignmentStatus.Active)
        {
            return NoContent();
        }

        var changedAt = DateTimeOffset.UtcNow;
        assignment.Status = CoachingAssignmentStatus.Revoked;
        assignment.EndsAt = changedAt;
        assignment.UpdatedAt = changedAt;
        if (assignment.IsPrimary && assignment.Role == CoachingRole.Strength)
        {
            var athlete = await database.PlatformUsers.SingleAsync(user => user.Id == assignment.AthleteUserId, cancellationToken);
            if (athlete.CoachId == assignment.CoachId)
            {
                athlete.CoachId = null;
                athlete.UpdatedAt = changedAt;
            }
        }
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}