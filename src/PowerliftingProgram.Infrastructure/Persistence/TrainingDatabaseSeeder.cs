using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Infrastructure.Persistence;

public static class TrainingDatabaseSeeder
{
    public static async Task SeedAsync(TrainingDbContext database, PasswordHashingService passwordHashingService, CancellationToken cancellationToken = default)
    {
        await SeedTestAccountsAsync(database, passwordHashingService, cancellationToken);

        const string demoExternalUserId = "demo-athlete";
        if (await database.AthleteProfiles.AnyAsync(
            profile => profile.ExternalUserId == demoExternalUserId,
            cancellationToken))
        {
            return;
        }

        var athlete = new AthleteProfile
        {
            Id = Guid.Parse("a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9"),
            ExternalUserId = demoExternalUserId,
            DisplayName = "Alex Morgan",
            Sex = AthleteSex.Male,
            BodyWeightKg = 82.5m,
            CompetitionWeightClass = "83 kg",
            SquatOneRepMaxKg = 215m,
            BenchOneRepMaxKg = 147.5m,
            DeadliftOneRepMaxKg = 250m,
            ActiveBlockTag = "Peak / Week 4",
            UpcomingMeetIdentifier = "Autumn Open",
            CumulativeWorkingSetTonnageKg = 1_982.5m,
            ExperiencePoints = 2_840,
            CurrentWorkoutStreak = 6,
            LastCompletedTrainingDate = new DateOnly(2026, 8, 27)
        };

        var block = new TrainingBlock
        {
            Id = Guid.Parse("b3a197ec-73bf-4c1e-b2de-3b9305a2f9f9"),
            AthleteProfileId = athlete.Id,
            AthleteProfile = athlete,
            Tag = "Peak / Week 4",
            Name = "Autumn Open Peak",
            StartsOn = new DateOnly(2026, 8, 3),
            EndsOn = new DateOnly(2026, 8, 30),
            IsActive = true
        };

        var week = new TrainingWeek
        {
            Id = Guid.Parse("30d2d5c4-3378-4df3-a7bb-051ec1d0b85a"),
            TrainingBlockId = block.Id,
            TrainingBlock = block,
            WeekNumber = 4,
            StartsOn = new DateOnly(2026, 8, 24)
        };

        var trainingDay = new TrainingDay
        {
            Id = Guid.Parse("4267d598-e6cf-40b2-80cb-b5ffccf2cbf4"),
            TrainingWeekId = week.Id,
            TrainingWeek = week,
            Name = "Day 1",
            Focus = "Competition squat / bench volume",
            ScheduledFor = new DateOnly(2026, 8, 27),
            StartedAt = new DateTimeOffset(2026, 8, 27, 16, 0, 0, TimeSpan.Zero)
        };

        var squat = new PrescribedExercise
        {
            Id = Guid.Parse("e98f497f-b2c1-462b-8dca-e79dace4b1e4"),
            TrainingDayId = trainingDay.Id,
            TrainingDay = trainingDay,
            Name = "Competition Squat",
            ExerciseType = ExerciseType.Squat,
            ExerciseTypeModifier = 1.15m,
            SortOrder = 1,
            TargetEstimatedOneRepMaxKg = 215m
        };
        var bench = new PrescribedExercise
        {
            Id = Guid.Parse("ee1dc2c3-9c8f-43b6-86b8-00c17004c135"),
            TrainingDayId = trainingDay.Id,
            TrainingDay = trainingDay,
            Name = "Paused Bench Press",
            ExerciseType = ExerciseType.BenchPress,
            ExerciseTypeModifier = 1m,
            SortOrder = 2,
            TargetEstimatedOneRepMaxKg = 147.5m
        };
        var row = new PrescribedExercise
        {
            Id = Guid.Parse("43161199-09d1-4afe-a40f-72fd61e1d564"),
            TrainingDayId = trainingDay.Id,
            TrainingDay = trainingDay,
            Name = "Chest-Supported Row",
            ExerciseType = ExerciseType.Accessory,
            ExerciseTypeModifier = 0.7m,
            SortOrder = 3,
            TargetEstimatedOneRepMaxKg = 100m
        };

        var squatSetOne = CreateSet(
            "1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd001", squat, 1, 4, 177.5m, 7.5m,
            SetCompletionStatus.Done, 4, 177.5m, 7.5m,
            "https://www.instagram.com/reel/C9DemoSquat1/", "Depth was consistent. Hold your brace through the walkout.");
        var squatSetTwo = CreateSet(
            "1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd002", squat, 2, 4, 177.5m, 7.5m,
            SetCompletionStatus.Done, 4, 177.5m, 8m, null, null);
        var squatSetThree = CreateSet(
            "1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd003", squat, 3, 4, 177.5m, 7.5m,
            SetCompletionStatus.Pending, null, null, null, null, null);
        var benchSetOne = CreateSet(
            "8f0e7a59-a084-4d9d-8d8e-4133eb3c7001", bench, 1, 5, 112.5m, 7m,
            SetCompletionStatus.Done, 5, 112.5m, 7m, null, null);
        var benchSetTwo = CreateSet(
            "8f0e7a59-a084-4d9d-8d8e-4133eb3c7002", bench, 2, 5, 112.5m, 7m,
            SetCompletionStatus.Pending, null, null, null, null, null);
        var benchSetThree = CreateSet(
            "8f0e7a59-a084-4d9d-8d8e-4133eb3c7003", bench, 3, 5, 112.5m, 7m,
            SetCompletionStatus.Pending, null, null, null, null, null);
        var rowSetOne = CreateSet(
            "7f3fdca8-6b78-4013-8e87-4b5d8f31c001", row, 1, 10, 70m, 8m,
            SetCompletionStatus.Pending, null, null, null, null, null);
        var rowSetTwo = CreateSet(
            "7f3fdca8-6b78-4013-8e87-4b5d8f31c002", row, 2, 10, 70m, 8m,
            SetCompletionStatus.Pending, null, null, null, null, null);

        var commentThread = new CommentThread
        {
            Id = Guid.Parse("3d9389ec-d31b-48fc-bfeb-586859a45317"),
            AthleteProfileId = athlete.Id,
            AthleteProfile = athlete,
            TrainingSetId = squatSetOne.Id,
            TrainingSet = squatSetOne,
            ContextType = CommentContextType.Set,
            Subject = "Competition squat set 1",
            IsResolved = false
        };
        var coachComment = new ThreadComment
        {
            Id = Guid.Parse("3756df81-bc5c-4c14-bb39-e0f68968000d"),
            CommentThreadId = commentThread.Id,
            CommentThread = commentThread,
            AuthorUserId = "coach-demo",
            AuthorDisplayName = "Coach Taylor",
            Message = "Strong first rep. Keep the knees tracking over the mid-foot on your final rep.",
            IsCoachComment = true
        };

        var achievement = new AthleteAchievement
        {
            Id = Guid.Parse("be3c4316-7494-48c4-8ec3-c65f0faaf7d8"),
            AthleteProfileId = athlete.Id,
            AthleteProfile = athlete,
            Type = AchievementType.ConsistencyStreak,
            BadgeCode = "streak-6",
            Title = "Six day consistency streak",
            EarnedAt = new DateTimeOffset(2026, 8, 27, 16, 25, 0, TimeSpan.Zero),
            Value = 6m
        };

        var processedCommand = new SyncCommand
        {
            Id = Guid.Parse("10f5d8a4-a0da-4677-9c4f-8a1df50555e2"),
            CommandId = Guid.Parse("70b495b3-cb5b-4dfc-bac0-1cad6b61162f"),
            AthleteProfileId = athlete.Id,
            AthleteProfile = athlete,
            AggregateId = squatSetOne.Id,
            CommandType = "attach-instagram-video",
            PayloadJson = "{\"trainingSetId\":\"1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd001\",\"instagramVideoUrl\":\"https://www.instagram.com/reel/C9DemoSquat1/\",\"athleteNote\":null,\"coachFormFlags\":null}",
            DeviceId = "development-seed",
            Status = SyncCommandStatus.Processed,
            ProcessedAt = new DateTimeOffset(2026, 8, 27, 16, 20, 0, TimeSpan.Zero)
        };

        database.AddRange(
            athlete, block, week, trainingDay, squat, bench, row,
            squatSetOne, squatSetTwo, squatSetThree,
            benchSetOne, benchSetTwo, benchSetThree, rowSetOne, rowSetTwo,
            commentThread, coachComment, achievement, processedCommand);
        await database.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedTestAccountsAsync(TrainingDbContext database, PasswordHashingService passwordHashingService, CancellationToken cancellationToken)
    {
        const string coachEmail = "coach@ironforge.local";
        const string athleteEmail = "athlete@ironforge.local";
        var coach = await database.PlatformUsers.SingleOrDefaultAsync(user => user.NormalizedEmail == coachEmail.ToUpperInvariant(), cancellationToken);
        if (coach is null)
        {
            coach = new PlatformUser
            {
                Id = Guid.Parse("6c425454-2eb1-4d42-942f-4f628600cfbd"),
                Email = coachEmail,
                NormalizedEmail = coachEmail.ToUpperInvariant(),
                DisplayName = "Demo Coach",
                PasswordHash = passwordHashingService.Hash("LocalDemoCoach!2026"),
                Role = PlatformRole.Coach,
                CanCoach = true
            };
            database.PlatformUsers.Add(coach);
        }

        var coachProfile = await database.AthleteProfiles.SingleOrDefaultAsync(profile => profile.PlatformUserId == coach.Id, cancellationToken);
        if (coachProfile is null)
        {
            database.AthleteProfiles.Add(new AthleteProfile
            {
                PlatformUserId = coach.Id,
                ExternalUserId = $"platform-{coach.Id}",
                DisplayName = coach.DisplayName,
                Sex = AthleteSex.PreferNotToSay,
                CompetitionWeightClass = "Unspecified"
            });
        }

        var athleteUser = await database.PlatformUsers.SingleOrDefaultAsync(user => user.NormalizedEmail == athleteEmail.ToUpperInvariant(), cancellationToken);
        if (athleteUser is null)
        {
            athleteUser = new PlatformUser
            {
                Id = Guid.Parse("822775a1-357c-4d48-894b-54598f4945a4"),
                Email = athleteEmail,
                NormalizedEmail = athleteEmail.ToUpperInvariant(),
                DisplayName = "Demo Athlete",
                PasswordHash = passwordHashingService.Hash("LocalDemoAthlete!2026"),
                Role = PlatformRole.Athlete,
                CoachId = coach.Id
            };
            database.PlatformUsers.Add(athleteUser);
        }
        else if (athleteUser.Role == PlatformRole.Athlete && athleteUser.CoachId != coach.Id)
        {
            athleteUser.CoachId = coach.Id;
            athleteUser.UpdatedAt = DateTimeOffset.UtcNow;
        }

        var athleteProfile = await database.AthleteProfiles.SingleOrDefaultAsync(profile => profile.PlatformUserId == athleteUser.Id, cancellationToken);
        if (athleteProfile is null)
        {
            database.AthleteProfiles.Add(new AthleteProfile
            {
                Id = Guid.Parse("edcd3643-d94d-4f75-b916-a605df16213b"),
                PlatformUserId = athleteUser.Id,
                ExternalUserId = $"platform-{athleteUser.Id}",
                DisplayName = athleteUser.DisplayName,
                Sex = AthleteSex.PreferNotToSay,
                CompetitionWeightClass = "Unspecified"
            });
        }

        await database.SaveChangesAsync(cancellationToken);
    }

    private static TrainingSet CreateSet(
        string id,
        PrescribedExercise exercise,
        int setNumber,
        int targetRepetitions,
        decimal targetLoadKg,
        decimal targetRpe,
        SetCompletionStatus completionStatus,
        int? actualRepetitions,
        decimal? actualLoadKg,
        decimal? actualRpe,
        string? instagramVideoUrl,
        string? coachFormFlags)
    {
        var isComplete = completionStatus == SetCompletionStatus.Done;
        return new TrainingSet
        {
            Id = Guid.Parse(id),
            PrescribedExerciseId = exercise.Id,
            PrescribedExercise = exercise,
            SetNumber = setNumber,
            Intent = exercise.ExerciseType == ExerciseType.Accessory ? SetIntent.Accessory : SetIntent.Working,
            TargetRepetitions = targetRepetitions,
            TargetLoadKg = targetLoadKg,
            TargetRpe = targetRpe,
            TargetEstimatedOneRepMaxKg = exercise.TargetEstimatedOneRepMaxKg,
            CompletionStatus = completionStatus,
            ActualRepetitions = actualRepetitions,
            ActualLoadKg = actualLoadKg,
            ActualRpe = actualRpe,
            ActualEstimatedOneRepMaxKg = isComplete && actualLoadKg is not null && actualRepetitions is not null
                ? decimal.Round(actualLoadKg.Value * (36m / (37m - actualRepetitions.Value)), 2)
                : null,
            ActualEffortPercentage = isComplete && actualRpe is not null
                ? decimal.Round(0.7m + ((actualRpe.Value - 1m) * (0.3m / 9m)), 3)
                : null,
            CompletedAt = isComplete ? new DateTimeOffset(2026, 8, 27, 16, 15, 0, TimeSpan.Zero) : null,
            InstagramVideoUrl = instagramVideoUrl,
            CoachFormFlags = coachFormFlags
        };
    }
}
