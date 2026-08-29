using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Api.Controllers;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Application.Tests;

public sealed class ExerciseLibraryControllerTests
{
    [Fact]
    public async Task Get_ReturnsSystemAndCurrentCoachItemsInBodyPartOrder()
    {
        await using var database = CreateDatabase();
        var coachId = Guid.NewGuid();
        database.ExerciseLibraryItems.AddRange(
            new ExerciseLibraryItem { Name = "Leg Press", BodyPart = ExerciseBodyPart.Legs },
            new ExerciseLibraryItem { CoachId = coachId, Name = "Custom Row", BodyPart = ExerciseBodyPart.Back },
            new ExerciseLibraryItem { CoachId = Guid.NewGuid(), Name = "Private Fly", BodyPart = ExerciseBodyPart.Chest });
        await database.SaveChangesAsync();
        var controller = CreateController(database, coachId);

        var result = await controller.Get(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var items = Assert.IsAssignableFrom<IReadOnlyList<ExerciseLibraryItemResponse>>(ok.Value);
        Assert.Equal(new[] { "Custom Row", "Leg Press" }, items.Select(item => item.Name));
        Assert.False(items[0].IsSystem);
        Assert.True(items[1].IsSystem);
    }

    [Fact]
    public async Task Create_AddsCoachOwnedExercise()
    {
        await using var database = CreateDatabase();
        var coachId = Guid.NewGuid();
        var controller = CreateController(database, coachId);

        var result = await controller.Create(new CreateExerciseLibraryItemRequest("  Belt Squat  ", ExerciseBodyPart.Legs), CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result.Result);
        var response = Assert.IsType<ExerciseLibraryItemResponse>(created.Value);
        Assert.Equal("Belt Squat", response.Name);
        Assert.False(response.IsSystem);
        var stored = await database.ExerciseLibraryItems.SingleAsync();
        Assert.Equal(coachId, stored.CoachId);
    }

    private static ExerciseLibraryController CreateController(TrainingDbContext database, Guid userId) => new(database)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                    new Claim(ClaimTypes.Role, "COACH")
                ], "test"))
            }
        }
    };

    private static TrainingDbContext CreateDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TrainingDbContext(options);
    }
}
