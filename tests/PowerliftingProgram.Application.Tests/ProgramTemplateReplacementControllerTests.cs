using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Api.Controllers;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;
using Xunit;

namespace PowerliftingProgram.Application.Tests;

public sealed class ProgramTemplateReplacementControllerTests
{
    [Fact]
    public async Task ReplaceTemplate_InMemory_PreservesParentAndRebuildsHierarchy()
    {
        await using var database = CreateInMemoryDatabase();
        await ReplaceTemplateAndAssert(database);
    }

    [Fact]
    public async Task ReplaceTemplate_Postgres_PreservesParentAndRebuildsHierarchy()
    {
        var connectionString = Environment.GetEnvironmentVariable("POWERLIFTING_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        await using var database = CreatePostgresDatabase(connectionString);
        await ReplaceTemplateAndAssert(database);
    }

    private static async Task ReplaceTemplateAndAssert(TrainingDbContext database)
    {
        var coach = CreateCoach();
        var template = CreateTemplate(coach.Id);
        database.AddRange(coach, template);
        await database.SaveChangesAsync();
        var originalTemplateId = template.Id;
        var originalWeekId = Assert.Single(template.Weeks).Id;
        var controller = CreateController(database, coach.Id);

        try
        {
            var result = await controller.ReplaceTemplate(originalTemplateId, ReplacementInput(), CancellationToken.None);

            Assert.IsType<NoContentResult>(result);
            database.ChangeTracker.Clear();
            var replaced = await database.ProgramTemplates.AsNoTracking()
                .Include(item => item.Weeks).ThenInclude(item => item.Days).ThenInclude(item => item.Exercises)
                .SingleAsync(item => item.Id == originalTemplateId);
            Assert.Equal("Updated template", replaced.Name);
            Assert.Equal("Updated goal", replaced.Goal);
            Assert.Equal("Peak", replaced.Phase);
            Assert.Equal(2, replaced.TrainingDaysPerWeek);
            Assert.Equal(2, replaced.Weeks.Count);
            Assert.DoesNotContain(replaced.Weeks, week => week.Id == originalWeekId);
            var secondDay = replaced.Weeks.Single(week => week.WeekNumber == 1).Days.Single(day => day.DayNumber == 2);
            var exercise = Assert.Single(secondDay.Exercises);
            Assert.Equal("Competition Bench", exercise.Name);
            Assert.Equal(3, exercise.Sets);
        }
        finally
        {
            database.ChangeTracker.Clear();
            if (database.Database.IsRelational())
            {
                await database.ProgramTemplates.Where(item => item.Id == originalTemplateId).ExecuteDeleteAsync();
                await database.PlatformUsers.Where(item => item.Id == coach.Id).ExecuteDeleteAsync();
            }
        }
    }

    private static ProgramTemplate CreateTemplate(Guid coachId)
    {
        var template = new ProgramTemplate
        {
            CoachId = coachId,
            Name = "Original template",
            Goal = "Original goal",
            Phase = "Base",
            TrainingDaysPerWeek = 1
        };
        var week = new ProgramTemplateWeek { WeekNumber = 1, Name = "Original week" };
        var day = new ProgramTemplateDay { DayNumber = 1, Name = "Original day", Focus = "Volume" };
        day.Exercises.Add(new ProgramTemplateExercise
        {
            SortOrder = 0,
            Name = "Original Squat",
            ExerciseType = ExerciseType.Squat,
            Sets = 5,
            Repetitions = 5,
            PrescriptionMode = TemplatePrescriptionMode.Rpe,
            PrescriptionValue = 7,
            WeightUnit = "kg"
        });
        week.Days.Add(day);
        template.Weeks.Add(week);
        return template;
    }

    private static ProgramTemplateInput ReplacementInput() => new(
        "Updated template",
        "Updated goal",
        "Peak",
        2,
        [
            new TemplateWeekInput(1, "Heavy week", [
                new TemplateDayInput(1, "Squat day", "Intensity", []),
                new TemplateDayInput(2, "Bench day", "Competition", [
                    new TemplateExerciseInput(0, "Competition Bench", ExerciseType.BenchPress, 3, 2, TemplatePrescriptionMode.Rpe, 8, "kg")
                ])
            ]),
            new TemplateWeekInput(2, "Taper week", [
                new TemplateDayInput(1, "Openers", "Specificity", [])
            ])
        ]);

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

    private static PlatformUser CreateCoach()
    {
        var email = $"template-replacement-{Guid.NewGuid():N}@example.com";
        return new PlatformUser
        {
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            DisplayName = "Template Replacement Coach",
            PasswordHash = "hash",
            Role = PlatformRole.Coach,
            CanCoach = true
        };
    }

    private static TrainingDbContext CreateInMemoryDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TrainingDbContext(options);
    }

    private static TrainingDbContext CreatePostgresDatabase(string connectionString)
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new TrainingDbContext(options);
    }
}