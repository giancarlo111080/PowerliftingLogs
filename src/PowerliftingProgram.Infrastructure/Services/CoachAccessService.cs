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
        var role = principal.FindFirstValue(ClaimTypes.Role);
        if (userId is null || role is null)
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

        if (role == "ATHLETE")
        {
            return athlete.PlatformUserId == userId;
        }

        return role == "COACH" && await database.PlatformUsers.AsNoTracking()
            .AnyAsync(user => user.Id == athlete.PlatformUserId && user.CoachId == userId, cancellationToken);
    }

    public async Task<bool> CoachOwnsAthleteAsync(Guid coachId, Guid athleteProfileId, CancellationToken cancellationToken) =>
        await database.AthleteProfiles.AsNoTracking()
            .Where(profile => profile.Id == athleteProfileId && profile.PlatformUserId != null)
            .Join(database.PlatformUsers.AsNoTracking(), profile => profile.PlatformUserId, user => user.Id, (_, user) => user)
            .AnyAsync(user => user.Role == PlatformRole.Athlete && user.CoachId == coachId, cancellationToken);

    public static Guid? CurrentUserId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;
}