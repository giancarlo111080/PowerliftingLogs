using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;
using Xunit;

namespace PowerliftingProgram.Application.Tests;

public sealed class CoachAccessServiceTests
{
    [Fact]
    public async Task DualCapabilityUser_CanAccessOwnAndLinkedAthleteProfiles()
    {
        await using var database = CreateDatabase();
        var coach = CreateUser("coach@example.com", canCoach: true);
        var linked = CreateUser("linked@example.com", coachId: coach.Id);
        var ownProfile = CreateProfile(coach);
        var linkedProfile = CreateProfile(linked);
        var assignment = CreateAssignment(coach, linked);
        database.AddRange(coach, linked, ownProfile, linkedProfile, assignment);
        await database.SaveChangesAsync();
        var principal = Principal(coach.Id, "ATHLETE", "COACH");
        var service = new CoachAccessService(database);

        Assert.True(await service.CanAccessAthleteAsync(principal, ownProfile.Id, CancellationToken.None));
        Assert.True(await service.CanAccessAthleteAsync(principal, linkedProfile.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Coach_CannotAccessUnlinkedAthleteProfile()
    {
        await using var database = CreateDatabase();
        var coach = CreateUser("coach@example.com", canCoach: true);
        var unrelated = CreateUser("unrelated@example.com");
        var unrelatedProfile = CreateProfile(unrelated);
        database.AddRange(coach, unrelated, unrelatedProfile);
        await database.SaveChangesAsync();

        var allowed = await new CoachAccessService(database).CanAccessAthleteAsync(
            Principal(coach.Id, "ATHLETE", "COACH"),
            unrelatedProfile.Id,
            CancellationToken.None);

        Assert.False(allowed);
    }

    [Fact]
    public async Task Coach_CannotRecordAthleteOwnedPerformance()
    {
        await using var database = CreateDatabase();
        var coach = CreateUser("coach@example.com", canCoach: true);
        var athlete = CreateUser("athlete@example.com", coachId: coach.Id);
        var profile = CreateProfile(athlete);
        database.AddRange(coach, athlete, profile, CreateAssignment(coach, athlete));
        await database.SaveChangesAsync();
        var service = new CoachAccessService(database);

        Assert.False(await service.CanRecordPerformanceAsync(Principal(coach.Id, "ATHLETE", "COACH"), profile.Id, CancellationToken.None));
        Assert.True(await service.CanRecordPerformanceAsync(Principal(athlete.Id, "ATHLETE"), profile.Id, CancellationToken.None));
    }

    private static PlatformUser CreateUser(string email, bool canCoach = false, Guid? coachId = null) => new()
    {
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        DisplayName = email,
        PasswordHash = "not-used",
        Role = canCoach ? PlatformRole.Coach : PlatformRole.Athlete,
        CanCoach = canCoach,
        CoachId = coachId
    };

    private static AthleteProfile CreateProfile(PlatformUser user) => new()
    {
        PlatformUserId = user.Id,
        ExternalUserId = $"platform-{user.Id}",
        DisplayName = user.DisplayName,
        Sex = AthleteSex.PreferNotToSay,
        CompetitionWeightClass = "Unspecified"
    };

    private static CoachingAssignment CreateAssignment(PlatformUser coach, PlatformUser athlete) => new()
    {
        CoachId = coach.Id,
        AthleteUserId = athlete.Id,
        Role = CoachingRole.Strength,
        AccessLevel = CoachingAccessLevel.Full,
        Status = CoachingAssignmentStatus.Active,
        IsPrimary = true
    };

    private static ClaimsPrincipal Principal(Guid userId, params string[] roles) => new(new ClaimsIdentity(
        roles.Select(role => new Claim(ClaimTypes.Role, role)).Prepend(new Claim(ClaimTypes.NameIdentifier, userId.ToString())),
        "test"));

    private static TrainingDbContext CreateDatabase() => new(new DbContextOptionsBuilder<TrainingDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);
}