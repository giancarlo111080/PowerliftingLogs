using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

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
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public ActionResult<IReadOnlyList<WorkingSetTarget>> CalculateWorkingSets([FromBody] WorkingSetCalculationRequest request)
    {
        if (request.EstimatedOneRepMaxKg is <= 0m or > 1_200m) ModelState.AddModelError(nameof(request.EstimatedOneRepMaxKg), "Estimated one-rep max must be between 0 and 1,200 kg.");
        if (request.Sets is < 1 or > 20) ModelState.AddModelError(nameof(request.Sets), "Set count must be between 1 and 20.");
        if (request.Repetitions is < 1 or > 100) ModelState.AddModelError(nameof(request.Repetitions), "Repetitions must be between 1 and 100.");
        if (request.TargetRpe is < 1m or > 10m) ModelState.AddModelError(nameof(request.TargetRpe), "Target RPE must be between 1 and 10.");
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        return Ok(calculationService.CalculateWorkingSets(
            request.EstimatedOneRepMaxKg,
            request.Sets,
            request.Repetitions,
            request.TargetRpe));
    }

    [HttpPost("warm-ups")]
    [ProducesResponseType(typeof(IReadOnlyList<WarmUpSet>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public ActionResult<IReadOnlyList<WarmUpSet>> CalculateWarmUps([FromBody] WarmUpCalculationRequest request)
    {
        if (request.WorkingLoadKg is <= 0m or > 1_200m) ModelState.AddModelError(nameof(request.WorkingLoadKg), "Working load must be between 0 and 1,200 kg.");
        if (request.BarbellKg is <= 0m or > 100m) ModelState.AddModelError(nameof(request.BarbellKg), "Barbell weight must be between 0 and 100 kg.");
        if (request.PlateIncrementKg is < 0.25m or > 25m) ModelState.AddModelError(nameof(request.PlateIncrementKg), "Plate increment must be between 0.25 and 25 kg.");
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

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
        var requestedDate = throughDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (requestedDate > DateOnly.FromDateTime(DateTime.UtcNow).AddYears(1))
        {
            ModelState.AddModelError(nameof(throughDate), "Readiness can be forecast at most one year ahead.");
            return ValidationProblem(ModelState);
        }
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

        return Ok(fatigueModelingService.CalculateReadiness(observations, requestedDate));
    }

    [HttpGet("days/{trainingDayId:guid}/analytics")]
    [ProducesResponseType(typeof(SessionStressAnalytics), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SessionStressAnalytics>> GetSessionAnalytics(
        Guid trainingDayId,
        [FromQuery] decimal athleteOneRepMaxKg,
        CancellationToken cancellationToken)
    {
        if (athleteOneRepMaxKg is <= 0m or > 1_200m)
        {
            ModelState.AddModelError(nameof(athleteOneRepMaxKg), "Athlete one-rep max must be between 0 and 1,200 kg.");
            return ValidationProblem(ModelState);
        }
        var athleteId = await database.TrainingDays
            .AsNoTracking()
            .Where(day => day.Id == trainingDayId)
            .Select(day => (Guid?)day.TrainingWeek!.TrainingBlock!.AthleteProfileId)
            .SingleOrDefaultAsync(cancellationToken);
        if (athleteId is null || !await coachAccessService.CanAccessAthleteAsync(User, athleteId.Value, cancellationToken))
        {
            return NotFound();
        }

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
