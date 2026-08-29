using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Infrastructure.Services;

public sealed class CoachAccessService(TrainingDbContext database)
{
    public async Task<bool> CanAccessAthleteAsync(ClaimsPrincipal principal, Guid athleteProfileId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId(principal);
        if (userId is null)
        {
            return false;
        }

        var athlete = await database.AthleteProfiles.AsNoTracking()
            .Where(profile => profile.Id == athleteProfileId)
            .Select(profile => new { profile.PlatformUserId })
            .SingleOrDefaultAsync(cancellationToken);
        if (athlete is null || athlete.PlatformUserId is null)
        {
            return false;
        }

        if (athlete.PlatformUserId == userId)
        {
            return true;
        }

        return principal.IsInRole("COACH") && await database.CoachingAssignments.AsNoTracking()
            .AnyAsync(assignment => assignment.CoachId == userId &&
                assignment.AthleteUserId == athlete.PlatformUserId &&
                assignment.Status == CoachingAssignmentStatus.Active &&
                assignment.AccessLevel >= CoachingAccessLevel.ReadOnly &&
                (assignment.EndsAt == null || assignment.EndsAt > DateTimeOffset.UtcNow), cancellationToken);
    }

    public async Task<bool> CoachOwnsAthleteAsync(Guid coachId, Guid athleteProfileId, CancellationToken cancellationToken) =>
        await database.AthleteProfiles.AsNoTracking()
            .Where(profile => profile.Id == athleteProfileId && profile.PlatformUserId != null)
            .Join(database.CoachingAssignments.AsNoTracking(), profile => profile.PlatformUserId, assignment => assignment.AthleteUserId, (_, assignment) => assignment)
            .AnyAsync(assignment => assignment.CoachId == coachId &&
                assignment.Status == CoachingAssignmentStatus.Active &&
                assignment.AccessLevel >= CoachingAccessLevel.Program &&
                (assignment.EndsAt == null || assignment.EndsAt > DateTimeOffset.UtcNow), cancellationToken);

    public async Task<bool> CanRecordPerformanceAsync(ClaimsPrincipal principal, Guid athleteProfileId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId(principal);
        return userId is not null && await database.AthleteProfiles.AsNoTracking()
            .AnyAsync(profile => profile.Id == athleteProfileId && profile.PlatformUserId == userId, cancellationToken);
    }

    public static Guid? CurrentUserId(ClaimsPrincipal principal) =>
            Guid.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId) ? userId : null;
}