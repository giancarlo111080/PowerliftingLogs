using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Api.Controllers;

public sealed record WorkingSetCalculationRequest(decimal EstimatedOneRepMaxKg, int Sets, int Repetitions, decimal TargetRpe);
public sealed record WarmUpCalculationRequest(decimal WorkingLoadKg, decimal BarbellKg = 20m, decimal PlateIncrementKg = 2.5m);

[Authorize]
[ApiController]
[Route("api/training")]
public sealed class TrainingAnalyticsController(
    ITrainingCalculationService calculationService,
    IFatigueModelingService fatigueModelingService,
    TrainingDbContext database,
    CoachAccessService coachAccessService) : ControllerBase
{
    [HttpPost("working-sets")]
    [ProducesResponseType(typeof(IReadOnlyList<WorkingSetTarget>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<WorkingSetTarget>> CalculateWorkingSets([FromBody] WorkingSetCalculationRequest request)
    {
        return Ok(calculationService.CalculateWorkingSets(
            request.EstimatedOneRepMaxKg,
            request.Sets,
            request.Repetitions,
            request.TargetRpe));
    }

    [HttpPost("warm-ups")]
    [ProducesResponseType(typeof(IReadOnlyList<WarmUpSet>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<WarmUpSet>> CalculateWarmUps([FromBody] WarmUpCalculationRequest request)
    {
        return Ok(calculationService.CalculateWarmUps(request.WorkingLoadKg, request.BarbellKg, request.PlateIncrementKg));
    }

    [HttpGet("athletes/{athleteId:guid}/readiness")]
    [ProducesResponseType(typeof(AthleteReadiness), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AthleteReadiness>> GetReadiness(
        Guid athleteId,
        [FromQuery] DateOnly? throughDate,
        CancellationToken cancellationToken)
    {
        if (!await coachAccessService.CanAccessAthleteAsync(User, athleteId, cancellationToken))
        {
            return Forbid();
        }
        var athlete = await database.AthleteProfiles.SingleOrDefaultAsync(profile => profile.Id == athleteId, cancellationToken);
        if (athlete is null)
        {
            return NotFound();
        }

        var completeSets = await database.TrainingSets
            .AsNoTracking()
            .Include(set => set.PrescribedExercise)
            .ThenInclude(exercise => exercise!.TrainingDay)
            .Where(set => set.PrescribedExercise!.TrainingDay!.TrainingWeek!.TrainingBlock!.AthleteProfileId == athleteId
                && set.CompletionStatus == SetCompletionStatus.Done
                && set.CompletedAt != null)
            .ToListAsync(cancellationToken);
        var observations = completeSets.Select(set => new LoadObservation(
            DateOnly.FromDateTime(set.CompletedAt!.Value.UtcDateTime),
            set.ActualRepetitions ?? 0,
            PercentOfOneRepMax(set.ActualLoadKg ?? 0m, athlete, set.PrescribedExercise!.ExerciseType),
            set.ActualEffortPercentage ?? 0.7m,
            set.PrescribedExercise.ExerciseTypeModifier));

        return Ok(fatigueModelingService.CalculateReadiness(observations, throughDate ?? DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpGet("days/{trainingDayId:guid}/analytics")]
    [ProducesResponseType(typeof(SessionStressAnalytics), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SessionStressAnalytics>> GetSessionAnalytics(
        Guid trainingDayId,
        [FromQuery] decimal athleteOneRepMaxKg,
        CancellationToken cancellationToken)
    {
        var trainingDay = await database.TrainingDays
            .AsNoTracking()
            .Include(day => day.TrainingWeek)
            .ThenInclude(week => week!.TrainingBlock)
            .Include(day => day.Exercises)
            .ThenInclude(exercise => exercise.Sets)
            .SingleOrDefaultAsync(day => day.Id == trainingDayId, cancellationToken);
        if (trainingDay is null)
        {
            return NotFound();
        }
        if (!await coachAccessService.CanAccessAthleteAsync(User, trainingDay.TrainingWeek!.TrainingBlock!.AthleteProfileId, cancellationToken))
        {
            return Forbid();
        }

        return Ok(calculationService.CalculateSessionAnalytics(trainingDay, athleteOneRepMaxKg));
    }

    private static decimal PercentOfOneRepMax(decimal loadKg, AthleteProfile athlete, ExerciseType exerciseType)
    {
        var oneRepMax = exerciseType switch
        {
            ExerciseType.Squat => athlete.SquatOneRepMaxKg,
            ExerciseType.BenchPress => athlete.BenchOneRepMaxKg,
            ExerciseType.Deadlift => athlete.DeadliftOneRepMaxKg,
            _ => 0m
        };
        return oneRepMax <= 0m ? 0m : loadKg / oneRepMax * 100m;
    }
}
