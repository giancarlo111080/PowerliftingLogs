using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;
using PowerliftingProgram.Application.Validators;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;
using Xunit;

namespace PowerliftingProgram.Application.Tests;

public sealed class WorkoutSyncServiceTests
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    [Fact]
    public async Task ProcessAsync_WhenCompletedSetIsEdited_UpdatesTonnageWithoutAwardingExperienceAgain()
    {
        await using var database = CreateDatabase();
        var athlete = CreateAthlete("athlete-one");
        var trainingSet = AddTrainingSet(database, athlete);
        await database.SaveChangesAsync();
        var service = CreateService(database);
        var actor = new SyncActor(Guid.NewGuid(), "Test Athlete", false);

        var firstOutcome = await service.ProcessAsync(
            [CreateLoggedSetCommand(athlete.Id, trainingSet.Id, 100m, 5)],
            actor,
            CancellationToken.None);
        var secondOutcome = await service.ProcessAsync(
            [CreateLoggedSetCommand(athlete.Id, trainingSet.Id, 120m, 5)],
            actor,
            CancellationToken.None);

        Assert.Equal(SyncCommandStatus.Processed, Assert.Single(firstOutcome).Status);
        Assert.Equal(SyncCommandStatus.Processed, Assert.Single(secondOutcome).Status);
        Assert.Equal(20, athlete.ExperiencePoints);
        Assert.Equal(600m, athlete.CumulativeWorkingSetTonnageKg);
    }

    [Fact]
    public async Task ProcessAsync_WhenSetBelongsToAnotherAthlete_RejectsCommandWithoutChangingSet()
    {
        await using var database = CreateDatabase();
        var requestingAthlete = CreateAthlete("requesting-athlete");
        var targetAthlete = CreateAthlete("target-athlete");
        database.AthleteProfiles.Add(requestingAthlete);
        var targetSet = AddTrainingSet(database, targetAthlete);
        await database.SaveChangesAsync();
        var service = CreateService(database);

        var outcomes = await service.ProcessAsync(
            [CreateLoggedSetCommand(requestingAthlete.Id, targetSet.Id, 200m, 3)],
            new SyncActor(Guid.NewGuid(), "Test Athlete", false),
            CancellationToken.None);

        var outcome = Assert.Single(outcomes);
        Assert.Equal(SyncCommandStatus.Rejected, outcome.Status);
        Assert.Equal(SetCompletionStatus.Pending, targetSet.CompletionStatus);
        Assert.Equal(0m, targetAthlete.CumulativeWorkingSetTonnageKg);
    }

    [Fact]
    public async Task ProcessAsync_WhenNestedLoggedSetPayloadIsInvalid_RejectsCommand()
    {
        await using var database = CreateDatabase();
        var athlete = CreateAthlete("invalid-payload-athlete");
        var trainingSet = AddTrainingSet(database, athlete);
        await database.SaveChangesAsync();

        var outcomes = await CreateService(database).ProcessAsync(
            [CreateLoggedSetCommand(athlete.Id, trainingSet.Id, 5_000m, 5)],
            new SyncActor(Guid.NewGuid(), "Test Athlete", false),
            CancellationToken.None);

        Assert.Equal(SyncCommandStatus.Rejected, Assert.Single(outcomes).Status);
        Assert.Equal(SetCompletionStatus.Pending, trainingSet.CompletionStatus);
        Assert.Equal(0m, athlete.CumulativeWorkingSetTonnageKg);
    }

    private static TrainingDbContext CreateDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TrainingDbContext(options);
    }

    private static WorkoutSyncService CreateService(TrainingDbContext database) => new(
        database,
        new GamificationService(),
        new LoggedSetValidator(),
        new InstagramVideoUrlPolicy());

    private static AthleteProfile CreateAthlete(string externalUserId) => new()
    {
        ExternalUserId = externalUserId,
        DisplayName = externalUserId,
        CompetitionWeightClass = "Unspecified",
        SquatOneRepMaxKg = 180m
    };

    private static TrainingSet AddTrainingSet(TrainingDbContext database, AthleteProfile athlete)
    {
        var block = new TrainingBlock
        {
            AthleteProfileId = athlete.Id,
            Tag = $"block-{athlete.Id:N}",
            Name = "Test block",
            StartsOn = new DateOnly(2026, 1, 1),
            EndsOn = new DateOnly(2026, 1, 7),
            IsActive = true
        };
        var week = new TrainingWeek
        {
            TrainingBlockId = block.Id,
            WeekNumber = 1,
            StartsOn = block.StartsOn
        };
        var day = new TrainingDay
        {
            TrainingWeekId = week.Id,
            Name = "Squat day",
            Focus = "Squat",
            ScheduledFor = block.StartsOn
        };
        var exercise = new PrescribedExercise
        {
            TrainingDayId = day.Id,
            Name = "Squat",
            ExerciseType = ExerciseType.Squat,
            SortOrder = 1
        };
        var trainingSet = new TrainingSet
        {
            PrescribedExerciseId = exercise.Id,
            SetNumber = 1,
            Intent = SetIntent.Working,
            TargetRepetitions = 5,
            TargetLoadKg = 100m,
            TargetRpe = 8m,
            CompletionStatus = SetCompletionStatus.Pending
        };
        database.AddRange(athlete, block, week, day, exercise, trainingSet);
        return trainingSet;
    }

    private static SyncCommandRequest CreateLoggedSetCommand(Guid athleteProfileId, Guid trainingSetId, decimal loadKg, int repetitions)
    {
        var commandId = Guid.NewGuid();
        var request = new LoggedSetRequest(
            commandId,
            athleteProfileId,
            trainingSetId,
            SetCompletionStatus.Done,
            loadKg,
            repetitions,
            8m,
            loadKg * 1.15m,
            0.9m,
            null,
            null);
        return new SyncCommandRequest(
            commandId,
            athleteProfileId,
            trainingSetId,
            "log-set",
            JsonSerializer.Serialize(request, JsonOptions),
            "test-device",
            DateTimeOffset.UtcNow);
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }
}