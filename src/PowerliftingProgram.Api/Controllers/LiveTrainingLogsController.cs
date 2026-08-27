using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record LiveSetResponse(Guid Id, int SetNumber, int TargetRepetitions, decimal TargetLoadKg, decimal TargetRpe, SetCompletionStatus CompletionStatus, decimal? ActualLoadKg, int? ActualRepetitions, decimal? ActualRpe);
public sealed record LiveExerciseResponse(Guid Id, int SortOrder, string Name, ExerciseType ExerciseType, TemplatePrescriptionMode PrescriptionMode, decimal PrescriptionValue, string WeightUnit, IReadOnlyList<LiveSetResponse> Sets);
public sealed record LiveTrainingDayResponse(Guid Id, string Name, string Focus, DateOnly ScheduledFor, IReadOnlyList<LiveExerciseResponse> Exercises);
public sealed record LiveTrainingWeekResponse(Guid Id, int WeekNumber, DateOnly StartsOn, IReadOnlyList<LiveTrainingDayResponse> Days);
public sealed record LiveTrainingLogResponse(Guid Id, Guid AthleteProfileId, Guid? ProgramTemplateId, string Name, DateOnly StartsOn, DateOnly EndsOn, IReadOnlyList<LiveTrainingWeekResponse> Weeks);

[Authorize]
[ApiController]
[Route("api/live-training")]
public sealed class LiveTrainingLogsController(TrainingDbContext database, CoachAccessService coachAccessService) : ControllerBase
{
    [Authorize(Roles = "ATHLETE")]
    [HttpGet("current")]
    [ProducesResponseType(typeof(LiveTrainingLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LiveTrainingLogResponse>> GetCurrent(CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }
        var athleteProfileId = await database.AthleteProfiles.AsNoTracking()
            .Where(profile => profile.PlatformUserId == userId)
            .Select(profile => (Guid?)profile.Id)
            .SingleOrDefaultAsync(cancellationToken);
        if (athleteProfileId is null)
        {
            return NotFound();
        }
        var log = await LiveLogQuery().SingleOrDefaultAsync(block => block.AthleteProfileId == athleteProfileId && block.IsActive, cancellationToken);
        return log is null ? NotFound() : Ok(ToResponse(log));
    }

    [Authorize(Roles = "COACH")]
    [HttpGet("athletes/{athleteProfileId:guid}")]
    [ProducesResponseType(typeof(LiveTrainingLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LiveTrainingLogResponse>> GetAthleteLog(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        if (!await coachAccessService.CanAccessAthleteAsync(User, athleteProfileId, cancellationToken))
        {
            return Forbid();
        }
        var log = await LiveLogQuery().SingleOrDefaultAsync(block => block.AthleteProfileId == athleteProfileId && block.IsActive, cancellationToken);
        return log is null ? NotFound() : Ok(ToResponse(log));
    }

    private IQueryable<TrainingBlock> LiveLogQuery() => database.TrainingBlocks.AsNoTracking()
        .Include(block => block.Weeks).ThenInclude(week => week.Days).ThenInclude(day => day.Exercises).ThenInclude(exercise => exercise.Sets);

    private static LiveTrainingLogResponse ToResponse(TrainingBlock block) => new(
        block.Id,
        block.AthleteProfileId,
        block.ProgramTemplateId,
        block.Name,
        block.StartsOn,
        block.EndsOn,
        block.Weeks.OrderBy(week => week.WeekNumber).Select(week => new LiveTrainingWeekResponse(
            week.Id,
            week.WeekNumber,
            week.StartsOn,
            week.Days.OrderBy(day => day.ScheduledFor).Select(day => new LiveTrainingDayResponse(
                day.Id,
                day.Name,
                day.Focus,
                day.ScheduledFor,
                day.Exercises.OrderBy(exercise => exercise.SortOrder).Select(exercise => new LiveExerciseResponse(
                    exercise.Id,
                    exercise.SortOrder,
                    exercise.Name,
                    exercise.ExerciseType,
                    exercise.PrescriptionMode,
                    exercise.PrescriptionValue,
                    exercise.WeightUnit,
                    exercise.Sets.OrderBy(set => set.SetNumber).Select(set => new LiveSetResponse(
                        set.Id,
                        set.SetNumber,
                        set.TargetRepetitions,
                        set.TargetLoadKg,
                        set.TargetRpe,
                        set.CompletionStatus,
                        set.ActualLoadKg,
                        set.ActualRepetitions,
                        set.ActualRpe)).ToList())).ToList())).ToList()));
}