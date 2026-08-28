using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Api.Controllers;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;
using Xunit;

namespace PowerliftingProgram.Application.Tests;

public sealed class PerformanceEventsControllerTests
{
    [Fact]
    public async Task AppendEvent_ReplayedStableKey_ReturnsExistingEvent()
    {
        await using var database = CreateDatabase();
        var fixture = await CreateFixture(database);
        var controller = CreateController(database, fixture.AthleteUser.Id);
        var request = RecoveryRequest("check-in-1", fixture.AthleteProfile.Id);

        var firstResult = await controller.AppendEvent(fixture.AthleteProfile.Id, request, CancellationToken.None);
        var replayResult = await controller.AppendEvent(fixture.AthleteProfile.Id, request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(firstResult.Result);
        var first = Assert.IsType<PerformanceEventResponse>(created.Value);
        var replay = Assert.IsType<PerformanceEventResponse>(Assert.IsType<OkObjectResult>(replayResult.Result).Value);
        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(fixture.Coach.Id, first.TenantId);
        Assert.Single(database.PerformanceEvents);
    }

    [Fact]
    public async Task AppendEvent_AthleteCannotCreateCoachDecision()
    {
        await using var database = CreateDatabase();
        var fixture = await CreateFixture(database);
        var controller = CreateController(database, fixture.AthleteUser.Id);
        var request = RecoveryRequest("decision-1", fixture.AthleteProfile.Id) with { Kind = PerformanceEventKind.CoachDecision };

        var result = await controller.AppendEvent(fixture.AthleteProfile.Id, request, CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
        Assert.Empty(database.PerformanceEvents);
    }

    [Fact]
    public async Task GetEvents_CoachCannotReadAnotherTenantAthlete()
    {
        await using var database = CreateDatabase();
        var fixture = await CreateFixture(database);
        var controller = CreateController(database, fixture.Coach.Id);

        var result = await controller.GetEvents(fixture.OtherAthleteProfile.Id, null, null, cancellationToken: CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task AppendEvent_PayloadAthleteDoesNotMatchRoute_ReturnsValidationProblem()
    {
        await using var database = CreateDatabase();
        var fixture = await CreateFixture(database);
        var controller = CreateController(database, fixture.AthleteUser.Id);
        var request = RecoveryRequest("wrong-athlete", Guid.NewGuid());

        var result = await controller.AppendEvent(fixture.AthleteProfile.Id, request, CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsAssignableFrom<ObjectResult>(result.Result).StatusCode);
        Assert.Empty(database.PerformanceEvents);
    }

    [Fact]
    public async Task AppendEvent_RecoveryScoreOutsideRange_ReturnsValidationProblem()
    {
        await using var database = CreateDatabase();
        var fixture = await CreateFixture(database);
        var controller = CreateController(database, fixture.AthleteUser.Id);
        var request = RecoveryRequest("invalid-score", fixture.AthleteProfile.Id) with
        {
            Payload = JsonSerializer.SerializeToElement(new { id = "recovery-invalid", athleteId = fixture.AthleteProfile.Id, recordedAt = DateTimeOffset.UtcNow, sleep = 11, soreness = 3, stress = 2, pain = 0, motivation = 8 })
        };

        var result = await controller.AppendEvent(fixture.AthleteProfile.Id, request, CancellationToken.None);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsAssignableFrom<ObjectResult>(result.Result).StatusCode);
        Assert.Empty(database.PerformanceEvents);
    }

    [Fact]
    public async Task DeleteEvents_AthleteDeletesOwnDerivedPerformanceHistory()
    {
        await using var database = CreateDatabase();
        var fixture = await CreateFixture(database);
        database.PerformanceEvents.Add(new PerformanceEvent
        {
            TenantId = fixture.Coach.Id,
            AthleteProfileId = fixture.AthleteProfile.Id,
            ActorUserId = fixture.Coach.Id,
            Kind = PerformanceEventKind.ModelPrediction,
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Source = "test",
            Provenance = "derived from test input",
            PayloadJson = "{}"
        });
        await database.SaveChangesAsync();
        var controller = CreateController(database, fixture.AthleteUser.Id);

        var result = await controller.DeleteEvents(fixture.AthleteProfile.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(database.PerformanceEvents);
    }

    private static AppendPerformanceEventRequest RecoveryRequest(string stableKey, Guid athleteProfileId) => new(
        PerformanceEventKind.RecoveryCheckIn,
        DateTimeOffset.UtcNow,
        "expo-client",
        1,
        "athlete recovery form",
        JsonSerializer.SerializeToElement(new { id = $"recovery-{stableKey}", athleteId = athleteProfileId, recordedAt = DateTimeOffset.UtcNow, sleep = 8, soreness = 3, stress = 2, pain = 0, motivation = 8 }),
        null,
        stableKey);

    private static PerformanceEventsController CreateController(TrainingDbContext database, Guid actorId) => new(database, new CoachAccessService(database))
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, actorId.ToString())], "test"))
            }
        }
    };

    private static async Task<Fixture> CreateFixture(TrainingDbContext database)
    {
        var coach = User("coach@example.com", "Coach", PlatformRole.Coach);
        var otherCoach = User("other-coach@example.com", "Other Coach", PlatformRole.Coach);
        var athleteUser = User("athlete@example.com", "Athlete", PlatformRole.Athlete, coach.Id);
        var otherAthleteUser = User("other-athlete@example.com", "Other Athlete", PlatformRole.Athlete, otherCoach.Id);
        var athleteProfile = Profile(athleteUser);
        var otherAthleteProfile = Profile(otherAthleteUser);
        database.AddRange(coach, otherCoach, athleteUser, otherAthleteUser, athleteProfile, otherAthleteProfile);
        await database.SaveChangesAsync();
        return new Fixture(coach, athleteUser, athleteProfile, otherAthleteProfile);
    }

    private static PlatformUser User(string email, string name, PlatformRole role, Guid? coachId = null) => new()
    {
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        DisplayName = name,
        PasswordHash = "not-used",
        Role = role,
        CoachId = coachId
    };

    private static AthleteProfile Profile(PlatformUser user) => new()
    {
        PlatformUserId = user.Id,
        ExternalUserId = $"platform-{user.Id}",
        DisplayName = user.DisplayName,
        Sex = AthleteSex.PreferNotToSay,
        CompetitionWeightClass = "Unspecified"
    };

    private static TrainingDbContext CreateDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new TrainingDbContext(options);
    }

    private sealed record Fixture(PlatformUser Coach, PlatformUser AthleteUser, AthleteProfile AthleteProfile, AthleteProfile OtherAthleteProfile);
}