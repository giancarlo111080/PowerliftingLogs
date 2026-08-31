using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Api.Controllers;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Application.Tests;

public sealed class ProgramOfferControllerTests
{
    [Fact]
    public async Task AssignTemplate_CreatesPendingOfferWithoutReplacingCurrentBlock()
    {
        await using var database = CreateDatabase();
        var coach = CreateUser(PlatformRole.Coach);
        var athleteUser = CreateUser(PlatformRole.Athlete);
        var athlete = CreateAthlete(athleteUser.Id);
        var template = new ProgramTemplate { CoachId = coach.Id, Name = "Meet Peak", Goal = "Peak for competition", Phase = "Peak", TrainingDaysPerWeek = 4 };
        template.Weeks.Add(new ProgramTemplateWeek { WeekNumber = 1, Name = "Week 1" });
        var current = CreateBlock(athlete.Id, TrainingBlockStatus.Accepted, true, "Current");
        database.AddRange(coach, athleteUser, athlete, template, current, new CoachingAssignment
        {
            CoachId = coach.Id,
            AthleteUserId = athleteUser.Id,
            AccessLevel = CoachingAccessLevel.Program,
            Status = CoachingAssignmentStatus.Active
        });
        await database.SaveChangesAsync();
        var controller = new ProgramTemplatesController(database, new CoachAccessService(database));
        SetUser(controller, coach.Id, "COACH");

        var result = await controller.AssignTemplate(template.Id, new AssignTemplateRequest(athlete.Id, new DateOnly(2026, 9, 1)), CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result.Result);
        var response = Assert.IsType<LiveTrainingBlockResponse>(created.Value);
        Assert.Equal(TrainingBlockStatus.Pending, response.Status);
        Assert.True((await database.TrainingBlocks.SingleAsync(block => block.Id == current.Id)).IsActive);
        var offer = await database.TrainingBlocks.SingleAsync(block => block.Id == response.Id);
        Assert.False(offer.IsActive);
        Assert.Equal(TrainingBlockStatus.Pending, offer.Status);
    }

    [Fact]
    public async Task AcceptOffer_CompletesCurrentBlockAndActivatesOffer()
    {
        await using var database = CreateDatabase();
        var athleteUser = CreateUser(PlatformRole.Athlete);
        var athlete = CreateAthlete(athleteUser.Id);
        var current = CreateBlock(athlete.Id, TrainingBlockStatus.Accepted, true, "Current");
        var offer = CreateBlock(athlete.Id, TrainingBlockStatus.Pending, false, "Next");
        database.AddRange(athleteUser, athlete, current, offer);
        await database.SaveChangesAsync();
        var controller = CreateLiveController(database, athleteUser.Id);

        var result = await controller.AcceptOffer(offer.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(TrainingBlockStatus.Completed, (await database.TrainingBlocks.SingleAsync(block => block.Id == current.Id)).Status);
        var accepted = await database.TrainingBlocks.SingleAsync(block => block.Id == offer.Id);
        Assert.True(accepted.IsActive);
        Assert.Equal(TrainingBlockStatus.Accepted, accepted.Status);
        Assert.NotNull(accepted.RespondedAt);
    }

    [Fact]
    public async Task DeclineOffer_LeavesCurrentBlockActive()
    {
        await using var database = CreateDatabase();
        var athleteUser = CreateUser(PlatformRole.Athlete);
        var athlete = CreateAthlete(athleteUser.Id);
        var current = CreateBlock(athlete.Id, TrainingBlockStatus.Accepted, true, "Current");
        var offer = CreateBlock(athlete.Id, TrainingBlockStatus.Pending, false, "Next");
        database.AddRange(athleteUser, athlete, current, offer);
        await database.SaveChangesAsync();
        var controller = CreateLiveController(database, athleteUser.Id);

        var result = await controller.DeclineOffer(offer.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.True((await database.TrainingBlocks.SingleAsync(block => block.Id == current.Id)).IsActive);
        Assert.Equal(TrainingBlockStatus.Declined, (await database.TrainingBlocks.SingleAsync(block => block.Id == offer.Id)).Status);
    }

    [Fact]
    public async Task AcceptOffer_ReturnsNotFoundForAnotherAthletesOffer()
    {
        await using var database = CreateDatabase();
        var ownerUser = CreateUser(PlatformRole.Athlete);
        var otherUser = CreateUser(PlatformRole.Athlete);
        var owner = CreateAthlete(ownerUser.Id);
        var other = CreateAthlete(otherUser.Id);
        var offer = CreateBlock(owner.Id, TrainingBlockStatus.Pending, false, "Private offer");
        database.AddRange(ownerUser, otherUser, owner, other, offer);
        await database.SaveChangesAsync();
        var controller = CreateLiveController(database, otherUser.Id);

        var result = await controller.AcceptOffer(offer.Id, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal(TrainingBlockStatus.Pending, (await database.TrainingBlocks.SingleAsync(block => block.Id == offer.Id)).Status);
    }

    private static LiveTrainingLogsController CreateLiveController(TrainingDbContext database, Guid userId)
    {
        var controller = new LiveTrainingLogsController(database, new CoachAccessService(database));
        SetUser(controller, userId, "ATHLETE");
        return controller;
    }

    private static void SetUser(ControllerBase controller, Guid userId, string role) => controller.ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, role)
            ], "test"))
        }
    };

    private static PlatformUser CreateUser(PlatformRole role) => new()
    {
        Email = $"{Guid.NewGuid():N}@example.com",
        NormalizedEmail = $"{Guid.NewGuid():N}@EXAMPLE.COM",
        DisplayName = "Test User",
        PasswordHash = "hash",
        Role = role
    };

    private static AthleteProfile CreateAthlete(Guid userId) => new()
    {
        PlatformUserId = userId,
        ExternalUserId = Guid.NewGuid().ToString("N"),
        DisplayName = "Test Athlete",
        CompetitionWeightClass = "Open"
    };

    private static TrainingBlock CreateBlock(Guid athleteId, TrainingBlockStatus status, bool isActive, string name) => new()
    {
        AthleteProfileId = athleteId,
        Tag = $"{name}-{Guid.NewGuid():N}",
        Name = name,
        StartsOn = new DateOnly(2026, 8, 1),
        EndsOn = new DateOnly(2026, 8, 28),
        IsActive = isActive,
        Status = status
    };

    private static TrainingDbContext CreateDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TrainingDbContext(options);
    }
}