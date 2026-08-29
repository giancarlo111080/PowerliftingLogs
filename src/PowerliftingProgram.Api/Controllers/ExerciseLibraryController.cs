using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record ExerciseLibraryItemResponse(Guid Id, string Name, ExerciseBodyPart BodyPart, bool IsSystem);
public sealed record CreateExerciseLibraryItemRequest(string Name, ExerciseBodyPart BodyPart);

[Authorize]
[ApiController]
[Route("api/exercise-library")]
public sealed class ExerciseLibraryController(TrainingDbContext database) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ExerciseLibraryItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ExerciseLibraryItemResponse>>> Get(CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var items = await database.ExerciseLibraryItems.AsNoTracking()
            .Where(item => item.IsActive && (item.CoachId == null || item.CoachId == userId))
            .OrderBy(item => item.BodyPart)
            .ThenBy(item => item.Name)
            .Select(item => new ExerciseLibraryItemResponse(item.Id, item.Name, item.BodyPart, item.CoachId == null))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

    [Authorize(Roles = "COACH")]
    [HttpPost]
    [ProducesResponseType(typeof(ExerciseLibraryItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ExerciseLibraryItemResponse>> Create(CreateExerciseLibraryItemRequest request, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 160)
        {
            ModelState.AddModelError(nameof(request.Name), "Exercise name is required and must be 160 characters or fewer.");
        }
        if (!Enum.IsDefined(request.BodyPart))
        {
            ModelState.AddModelError(nameof(request.BodyPart), "Select a valid body part.");
        }
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var normalizedName = request.Name.Trim();
        if (await database.ExerciseLibraryItems.AnyAsync(item => item.CoachId == coachId && item.Name.ToUpper() == normalizedName.ToUpper(), cancellationToken))
        {
            ModelState.AddModelError(nameof(request.Name), "This exercise is already in your catalog.");
            return ValidationProblem(ModelState);
        }

        var item = new ExerciseLibraryItem { CoachId = coachId, Name = normalizedName, BodyPart = request.BodyPart };
        database.ExerciseLibraryItems.Add(item);
        await database.SaveChangesAsync(cancellationToken);
        return Created($"/api/exercise-library/{item.Id}", new ExerciseLibraryItemResponse(item.Id, item.Name, item.BodyPart, false));
    }

    [Authorize(Roles = "COACH")]
    [HttpDelete("{itemId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid itemId, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        var item = await database.ExerciseLibraryItems.SingleOrDefaultAsync(candidate => candidate.Id == itemId && candidate.CoachId == coachId, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }
        database.ExerciseLibraryItems.Remove(item);
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
