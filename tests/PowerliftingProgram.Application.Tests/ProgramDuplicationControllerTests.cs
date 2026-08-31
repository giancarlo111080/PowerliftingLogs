using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Api.Controllers;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Application.Tests;

public sealed class ProgramDuplicationControllerTests
{
    [Fact]
    public async Task DuplicateLiveTrainingDay_CopiesPrescriptionWithoutAthleteResults()
    {
        await using var database = CreateDatabase();
        var coach = CreateCoach();
        var athlete = CreateAthlete();
        var block = CreateBlock(coach.Id, athlete.Id);
        var week = new TrainingWeek { WeekNumber = 1, StartsOn = new DateOnly(2026, 8, 3) };
        var day = new TrainingDay { Name = "Squat", Focus = "Technique", ScheduledFor = new DateOnly(2026, 8, 3) };
        var exercise = new PrescribedExercise { Name = "Competition Squat", ExerciseType = ExerciseType.Squat, SortOrder = 0, PrescriptionMode = TemplatePrescriptionMode.Rpe, PrescriptionValue = 7, WeightUnit = "kg" };
        exercise.Sets.Add(new TrainingSet { SetNumber = 1, Intent = SetIntent.Working, TargetRepetitions = 5, TargetLoadKg = 120, TargetRpe = 7, CompletionStatus = SetCompletionStatus.Done, ActualLoadKg = 125, ActualRepetitions = 5, CompletedAt = DateTimeOffset.UtcNow, AthleteNote = "Moved well" });
        day.Exercises.Add(exercise);
        week.Days.Add(day);
        block.Weeks.Add(week);
        database.AddRange(coach, athlete, block);
        await database.SaveChangesAsync();
        var controller = CreateController(database, coach.Id);

        var result = await controller.DuplicateLiveTrainingDay(day.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        var days = await database.TrainingDays.AsNoTracking().Include(item => item.Exercises).ThenInclude(item => item.Sets).OrderBy(item => item.ScheduledFor).ToListAsync();
        Assert.Equal(2, days.Count);
        Assert.Equal(new DateOnly(2026, 8, 4), days[1].ScheduledFor);
        var copiedSet = Assert.Single(Assert.Single(days[1].Exercises).Sets);
        Assert.Equal(SetCompletionStatus.Pending, copiedSet.CompletionStatus);
        Assert.Null(copiedSet.ActualLoadKg);
        Assert.Null(copiedSet.CompletedAt);
        Assert.Null(copiedSet.AthleteNote);
    }

    [Fact]
    public async Task DuplicateLiveTrainingWeek_AppendsShiftedWeekAndRejectsAnotherCoach()
    {
        await using var database = CreateDatabase();
        var coach = CreateCoach();
        var otherCoach = CreateCoach();
        var athlete = CreateAthlete();
        var block = CreateBlock(coach.Id, athlete.Id);
        var week = new TrainingWeek { WeekNumber = 1, StartsOn = new DateOnly(2026, 8, 3) };
        week.Days.Add(new TrainingDay { Name = "Bench", Focus = "Volume", ScheduledFor = new DateOnly(2026, 8, 5) });
        block.Weeks.Add(week);
        database.AddRange(coach, otherCoach, athlete, block);
        await database.SaveChangesAsync();

        var forbidden = await CreateController(database, otherCoach.Id).DuplicateLiveTrainingWeek(week.Id, CancellationToken.None);
        Assert.IsType<ForbidResult>(forbidden);

        var result = await CreateController(database, coach.Id).DuplicateLiveTrainingWeek(week.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        var weeks = await database.TrainingWeeks.AsNoTracking().Include(item => item.Days).OrderBy(item => item.WeekNumber).ToListAsync();
        Assert.Equal(2, weeks.Count);
        Assert.Equal(2, weeks[1].WeekNumber);
        Assert.Equal(new DateOnly(2026, 8, 10), weeks[1].StartsOn);
        Assert.Equal(new DateOnly(2026, 8, 12), Assert.Single(weeks[1].Days).ScheduledFor);
    }

    private static ProgramTemplatesController CreateController(TrainingDbContext database, Guid coachId) => new(database, new CoachAccessService(database))
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([
                    new Claim(ClaimTypes.NameIdentifier, coachId.ToString()),
                    new Claim(ClaimTypes.Role, "COACH")
                ], "test"))
            }
        }
    };

    private static PlatformUser CreateCoach() => new()
    {
        Email = $"{Guid.NewGuid():N}@example.com",
        NormalizedEmail = $"{Guid.NewGuid():N}@EXAMPLE.COM",
        DisplayName = "Coach",
        PasswordHash = "hash",
        Role = PlatformRole.Coach,
        CanCoach = true
    };

    private static AthleteProfile CreateAthlete() => new()
    {
        ExternalUserId = Guid.NewGuid().ToString("N"),
        DisplayName = "Athlete",
        CompetitionWeightClass = "Open"
    };

    private static TrainingBlock CreateBlock(Guid coachId, Guid athleteId) => new()
    {
        AthleteProfileId = athleteId,
        CoachId = coachId,
        Tag = Guid.NewGuid().ToString("N"),
        Name = "Live Program",
        StartsOn = new DateOnly(2026, 8, 3),
        EndsOn = new DateOnly(2026, 8, 9),
        IsActive = true,
        Status = TrainingBlockStatus.Accepted
    };

    private static TrainingDbContext CreateDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TrainingDbContext(options);
    }
}