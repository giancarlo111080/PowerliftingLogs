using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record TemplateExerciseInput(
    int SortOrder,
    string Name,
    ExerciseType ExerciseType,
    int Sets,
    int Repetitions,
    TemplatePrescriptionMode PrescriptionMode,
    decimal PrescriptionValue,
    string WeightUnit);

public sealed record TemplateDayInput(int DayNumber, string Name, string Focus, IReadOnlyList<TemplateExerciseInput> Exercises);
public sealed record TemplateWeekInput(int WeekNumber, string Name, IReadOnlyList<TemplateDayInput> Days);
public sealed record ProgramTemplateInput(string Name, string Goal, string? Phase, int TrainingDaysPerWeek, IReadOnlyList<TemplateWeekInput> Weeks);
public sealed record AssignTemplateRequest(Guid AthleteProfileId, DateOnly StartDate);
public sealed record LiveExerciseUpdate(Guid ExerciseId, string Name, ExerciseType ExerciseType, int Sets, int Repetitions, TemplatePrescriptionMode PrescriptionMode, decimal PrescriptionValue, string WeightUnit);
public sealed record LiveTrainingDayUpdate(string Name, string Focus, DateOnly ScheduledFor, IReadOnlyList<LiveExerciseUpdate> Exercises);
public sealed record ProgramTemplateExerciseResponse(Guid Id, int SortOrder, string Name, ExerciseType ExerciseType, int Sets, int Repetitions, TemplatePrescriptionMode PrescriptionMode, decimal PrescriptionValue, string WeightUnit);
public sealed record ProgramTemplateDayResponse(Guid Id, int DayNumber, string Name, string Focus, IReadOnlyList<ProgramTemplateExerciseResponse> Exercises);
public sealed record ProgramTemplateWeekResponse(Guid Id, int WeekNumber, string Name, IReadOnlyList<ProgramTemplateDayResponse> Days);
public sealed record ProgramTemplateResponse(Guid Id, string Name, string Goal, string? Phase, int TrainingDaysPerWeek, DateTimeOffset UpdatedAt, IReadOnlyList<ProgramTemplateWeekResponse> Weeks);
public sealed record LiveTrainingBlockResponse(Guid Id, Guid AthleteProfileId, Guid ProgramTemplateId, string Name, DateOnly StartsOn, DateOnly EndsOn);

[Authorize(Roles = "COACH")]
[ApiController]
[Route("api/program-templates")]
public sealed class ProgramTemplatesController(
    TrainingDbContext database,
    CoachAccessService coachAccessService) : ControllerBase
{
    private const int MaxTemplateWeeks = 52;
    private const int MaxDaysPerWeek = 7;
    private const int MaxExercisesPerDay = 20;
    private const int MaxSetsPerExercise = 20;
    private const int MaxGeneratedSets = 5_000;

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ProgramTemplateResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ProgramTemplateResponse>>> GetTemplates(CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }

        var templates = await TemplateQuery().AsNoTracking().Where(template => template.CoachId == coachId)
            .OrderByDescending(template => template.UpdatedAt).ToListAsync(cancellationToken);
        return Ok(templates.Select(ToResponse).ToList());
    }

    [HttpPost]
    [ProducesResponseType(typeof(ProgramTemplateResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProgramTemplateResponse>> CreateTemplate([FromBody] ProgramTemplateInput input, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        ValidateTemplate(input);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var template = BuildTemplate(input, coachId.Value);
        database.ProgramTemplates.Add(template);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetTemplate), new { templateId = template.Id }, ToResponse(template));
    }

    [HttpGet("{templateId:guid}")]
    [ProducesResponseType(typeof(ProgramTemplateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProgramTemplateResponse>> GetTemplate(Guid templateId, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        var template = await TemplateQuery().SingleOrDefaultAsync(candidate => candidate.Id == templateId && candidate.CoachId == coachId, cancellationToken);
        return template is null ? NotFound() : Ok(ToResponse(template));
    }

    [HttpPut("{templateId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReplaceTemplate(Guid templateId, [FromBody] ProgramTemplateInput input, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        ValidateTemplate(input);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var template = await TemplateQuery().SingleOrDefaultAsync(candidate => candidate.Id == templateId && candidate.CoachId == coachId, cancellationToken);
        if (template is null)
        {
            return NotFound();
        }

        database.ProgramTemplateExercises.RemoveRange(template.Weeks.SelectMany(week => week.Days).SelectMany(day => day.Exercises));
        database.ProgramTemplateDays.RemoveRange(template.Weeks.SelectMany(week => week.Days));
        database.ProgramTemplateWeeks.RemoveRange(template.Weeks);
        template.Weeks.Clear();
        ApplyTemplateInput(template, input);
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{templateId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTemplate(Guid templateId, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        var template = await database.ProgramTemplates.SingleOrDefaultAsync(candidate => candidate.Id == templateId && candidate.CoachId == coachId, cancellationToken);
        if (template is null)
        {
            return NotFound();
        }
        database.ProgramTemplates.Remove(template);
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{templateId:guid}/assignments")]
    [ProducesResponseType(typeof(LiveTrainingBlockResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LiveTrainingBlockResponse>> AssignTemplate(Guid templateId, [FromBody] AssignTemplateRequest request, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        var template = await TemplateQuery().SingleOrDefaultAsync(candidate => candidate.Id == templateId && candidate.CoachId == coachId, cancellationToken);
        if (template is null)
        {
            return NotFound();
        }
        if (!await coachAccessService.CoachOwnsAthleteAsync(coachId.Value, request.AthleteProfileId, cancellationToken))
        {
            return Forbid();
        }

        var athlete = await database.AthleteProfiles.SingleAsync(profile => profile.Id == request.AthleteProfileId, cancellationToken);
        var existingActiveBlocks = await database.TrainingBlocks
            .Where(block => block.AthleteProfileId == athlete.Id && block.IsActive)
            .ToListAsync(cancellationToken);
        existingActiveBlocks.ForEach(block => block.IsActive = false);

        var finalDate = request.StartDate;
        var block = new TrainingBlock
        {
            AthleteProfileId = athlete.Id,
            CoachId = coachId,
            ProgramTemplateId = template.Id,
            Tag = $"{template.Name[..Math.Min(template.Name.Length, 50)]}-{request.StartDate:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6]}",
            Name = template.Name,
            StartsOn = request.StartDate,
            EndsOn = request.StartDate,
            IsActive = true
        };
        foreach (var templateWeek in template.Weeks.OrderBy(week => week.WeekNumber))
        {
            var week = new TrainingWeek { WeekNumber = templateWeek.WeekNumber, StartsOn = request.StartDate.AddDays((templateWeek.WeekNumber - 1) * 7) };
            foreach (var templateDay in templateWeek.Days.OrderBy(day => day.DayNumber))
            {
                var scheduledFor = week.StartsOn.AddDays(templateDay.DayNumber - 1);
                finalDate = finalDate > scheduledFor ? finalDate : scheduledFor;
                var day = new TrainingDay { Name = templateDay.Name, Focus = templateDay.Focus, ScheduledFor = scheduledFor };
                foreach (var templateExercise in templateDay.Exercises.OrderBy(exercise => exercise.SortOrder))
                {
                    var exercise = CreateLiveExercise(templateExercise, athlete);
                    for (var setNumber = 1; setNumber <= templateExercise.Sets; setNumber++)
                    {
                        exercise.Sets.Add(new TrainingSet
                        {
                            SetNumber = setNumber,
                            Intent = templateExercise.ExerciseType == ExerciseType.Accessory ? SetIntent.Accessory : SetIntent.Working,
                            TargetRepetitions = templateExercise.Repetitions,
                            TargetLoadKg = ResolveTargetLoad(templateExercise, athlete),
                            TargetRpe = templateExercise.PrescriptionMode == TemplatePrescriptionMode.Rpe ? templateExercise.PrescriptionValue : 0m,
                            TargetEstimatedOneRepMaxKg = ResolveOneRepMax(athlete, templateExercise.ExerciseType),
                            CompletionStatus = SetCompletionStatus.Pending
                        });
                    }
                    day.Exercises.Add(exercise);
                }
                week.Days.Add(day);
            }
            block.Weeks.Add(week);
        }
        block.EndsOn = finalDate;
        database.TrainingBlocks.Add(block);
        await database.SaveChangesAsync(cancellationToken);
        return Created($"/api/live-training/blocks/{block.Id}", new LiveTrainingBlockResponse(block.Id, athlete.Id, template.Id, block.Name, block.StartsOn, block.EndsOn));
    }

    [HttpPut("/api/live-training/days/{trainingDayId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLiveTrainingDay(Guid trainingDayId, [FromBody] LiveTrainingDayUpdate update, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }
        var day = await database.TrainingDays
            .Include(item => item.TrainingWeek).ThenInclude(week => week!.TrainingBlock).ThenInclude(block => block!.AthleteProfile)
            .Include(item => item.Exercises).ThenInclude(exercise => exercise.Sets)
            .SingleOrDefaultAsync(item => item.Id == trainingDayId, cancellationToken);
        if (day?.TrainingWeek?.TrainingBlock?.CoachId != coachId)
        {
            return day is null ? NotFound() : Forbid();
        }
        if (string.IsNullOrWhiteSpace(update.Name) || update.Name.Trim().Length > 160
            || (update.Focus?.Trim().Length ?? 0) > 160
            || update.Exercises.Count is 0 or > MaxExercisesPerDay
            || update.Exercises.Select(exercise => exercise.ExerciseId).Distinct().Count() != update.Exercises.Count)
        {
            return BadRequest(new ProblemDetails { Title = $"A live training day needs a valid name, focus, and 1-{MaxExercisesPerDay} unique exercises." });
        }

        var updatedAt = DateTimeOffset.UtcNow;
        day.Name = update.Name.Trim();
        day.Focus = update.Focus?.Trim() ?? string.Empty;
        day.ScheduledFor = update.ScheduledFor;
        day.UpdatedAt = updatedAt;
        day.TrainingWeek.TrainingBlock.UpdatedAt = updatedAt;
        var athlete = day.TrainingWeek.TrainingBlock.AthleteProfile;
        if (athlete is null)
        {
            return NotFound();
        }
        foreach (var input in update.Exercises)
        {
            var exercise = day.Exercises.SingleOrDefault(candidate => candidate.Id == input.ExerciseId);
            if (exercise is null || input.Sets is < 1 or > MaxSetsPerExercise || input.Repetitions is < 1 or > 100
                || string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160
                || !Enum.IsDefined(input.ExerciseType) || !Enum.IsDefined(input.PrescriptionMode)
                || !IsValidPrescription(input.PrescriptionMode, input.PrescriptionValue) || input.WeightUnit is not ("kg" or "lb"))
            {
                return BadRequest(new ProblemDetails { Title = $"Each live exercise must exist and contain valid volume of at most {MaxSetsPerExercise} sets and 100 repetitions." });
            }
            exercise.Name = input.Name.Trim();
            exercise.ExerciseType = input.ExerciseType;
            exercise.PrescriptionMode = input.PrescriptionMode;
            exercise.PrescriptionValue = input.PrescriptionValue;
            exercise.WeightUnit = input.WeightUnit;
            exercise.TargetEstimatedOneRepMaxKg = ResolveOneRepMax(athlete, input.ExerciseType);
            exercise.UpdatedAt = updatedAt;
            AdjustLiveSets(exercise, input.Sets, input.Repetitions, input.PrescriptionMode, input.PrescriptionValue, input.WeightUnit, athlete);
        }
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private IQueryable<ProgramTemplate> TemplateQuery() => database.ProgramTemplates
        .Include(template => template.Weeks).ThenInclude(week => week.Days).ThenInclude(day => day.Exercises);

    private static ProgramTemplateResponse ToResponse(ProgramTemplate template) => new(
        template.Id,
        template.Name,
        template.Goal,
        template.Phase,
        template.TrainingDaysPerWeek,
        template.UpdatedAt,
        template.Weeks.OrderBy(week => week.WeekNumber).Select(week => new ProgramTemplateWeekResponse(
            week.Id,
            week.WeekNumber,
            week.Name,
            week.Days.OrderBy(day => day.DayNumber).Select(day => new ProgramTemplateDayResponse(
                day.Id,
                day.DayNumber,
                day.Name,
                day.Focus,
                day.Exercises.OrderBy(exercise => exercise.SortOrder).Select(exercise => new ProgramTemplateExerciseResponse(
                    exercise.Id,
                    exercise.SortOrder,
                    exercise.Name,
                    exercise.ExerciseType,
                    exercise.Sets,
                    exercise.Repetitions,
                    exercise.PrescriptionMode,
                    exercise.PrescriptionValue,
                    exercise.WeightUnit)).ToList())).ToList())).ToList());

    private void ValidateTemplate(ProgramTemplateInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160) ModelState.AddModelError(nameof(input.Name), "Template name is required and must be 160 characters or fewer.");
        if (string.IsNullOrWhiteSpace(input.Goal) || input.Goal.Trim().Length > 1_000) ModelState.AddModelError(nameof(input.Goal), "Coaching goal is required and must be 1,000 characters or fewer.");
        if (input.Phase?.Trim().Length > 80) ModelState.AddModelError(nameof(input.Phase), "Training phase must be 80 characters or fewer.");
        if (input.TrainingDaysPerWeek is < 1 or > 7) ModelState.AddModelError(nameof(input.TrainingDaysPerWeek), "Training days per week must be between 1 and 7.");
        if (input.Weeks.Count is 0 or > MaxTemplateWeeks) ModelState.AddModelError(nameof(input.Weeks), $"A template needs between 1 and {MaxTemplateWeeks} weeks.");
        if (input.Weeks.GroupBy(week => week.WeekNumber).Any(group => group.Key is < 1 or > MaxTemplateWeeks || group.Count() != 1)) ModelState.AddModelError(nameof(input.Weeks), $"Week numbers must be unique and between 1 and {MaxTemplateWeeks}.");
        if (input.Weeks.Any(week => string.IsNullOrWhiteSpace(week.Name) || week.Name.Trim().Length > 120 || week.Days.Count is 0 or > MaxDaysPerWeek)) ModelState.AddModelError(nameof(input.Weeks), $"Every week needs a name of at most 120 characters and between 1 and {MaxDaysPerWeek} days.");
        if (input.Weeks.SelectMany(week => week.Days).Any(day => day.DayNumber is < 1 or > 7 || string.IsNullOrWhiteSpace(day.Name) || day.Name.Trim().Length > 160 || day.Focus?.Trim().Length > 160 || day.Exercises.Count > MaxExercisesPerDay)) ModelState.AddModelError(nameof(input.Weeks), $"Every day needs a valid position and name; focus is optional and exercises can be added later, up to {MaxExercisesPerDay}.");
        if (input.Weeks.Any(week => week.Days.GroupBy(day => day.DayNumber).Any(group => group.Count() != 1))) ModelState.AddModelError(nameof(input.Weeks), "Day numbers must be unique within each week.");
        var exercises = input.Weeks.SelectMany(week => week.Days).SelectMany(day => day.Exercises).ToList();
        if (input.Weeks.SelectMany(week => week.Days).Any(day => day.Exercises.GroupBy(exercise => exercise.SortOrder).Any(group => group.Key < 0 || group.Count() != 1))) ModelState.AddModelError(nameof(input.Weeks), "Exercise positions must be unique non-negative values within each day.");
        if (exercises.Any(exercise => string.IsNullOrWhiteSpace(exercise.Name) || exercise.Name.Trim().Length > 160 || exercise.Sets is < 1 or > MaxSetsPerExercise || exercise.Repetitions is < 1 or > 100 || !Enum.IsDefined(exercise.ExerciseType) || !Enum.IsDefined(exercise.PrescriptionMode) || !IsValidPrescription(exercise.PrescriptionMode, exercise.PrescriptionValue) || exercise.WeightUnit is not ("kg" or "lb"))) ModelState.AddModelError(nameof(input.Weeks), $"Every exercise needs a valid name, target, unit, and volume of at most {MaxSetsPerExercise} sets and 100 repetitions.");
        if (exercises.Sum(exercise => exercise.Sets) > MaxGeneratedSets) ModelState.AddModelError(nameof(input.Weeks), $"A template cannot generate more than {MaxGeneratedSets:N0} sets.");
    }

    private static ProgramTemplate BuildTemplate(ProgramTemplateInput input, Guid coachId)
    {
        var template = new ProgramTemplate { CoachId = coachId, Name = input.Name.Trim(), Goal = input.Goal.Trim(), Phase = input.Phase?.Trim(), TrainingDaysPerWeek = input.TrainingDaysPerWeek };
        ApplyTemplateInput(template, input);
        return template;
    }

    private static void ApplyTemplateInput(ProgramTemplate template, ProgramTemplateInput input)
    {
        template.Name = input.Name.Trim();
        template.Goal = input.Goal.Trim();
        template.Phase = input.Phase?.Trim();
        template.TrainingDaysPerWeek = input.TrainingDaysPerWeek;
        template.UpdatedAt = DateTimeOffset.UtcNow;
        foreach (var inputWeek in input.Weeks.OrderBy(week => week.WeekNumber))
        {
            var week = new ProgramTemplateWeek { WeekNumber = inputWeek.WeekNumber, Name = inputWeek.Name.Trim() };
            foreach (var inputDay in inputWeek.Days.OrderBy(day => day.DayNumber))
            {
                var day = new ProgramTemplateDay { DayNumber = inputDay.DayNumber, Name = inputDay.Name.Trim(), Focus = inputDay.Focus?.Trim() ?? string.Empty };
                foreach (var inputExercise in inputDay.Exercises.OrderBy(exercise => exercise.SortOrder))
                {
                    day.Exercises.Add(new ProgramTemplateExercise
                    {
                        SortOrder = inputExercise.SortOrder,
                        Name = inputExercise.Name.Trim(),
                        ExerciseType = inputExercise.ExerciseType,
                        Sets = inputExercise.Sets,
                        Repetitions = inputExercise.Repetitions,
                        PrescriptionMode = inputExercise.PrescriptionMode,
                        PrescriptionValue = inputExercise.PrescriptionValue,
                        WeightUnit = inputExercise.WeightUnit
                    });
                }
                week.Days.Add(day);
            }
            template.Weeks.Add(week);
        }
    }

    private static PrescribedExercise CreateLiveExercise(ProgramTemplateExercise source, AthleteProfile athlete) => new()
    {
        Name = source.Name,
        ExerciseType = source.ExerciseType,
        SortOrder = source.SortOrder,
        PrescriptionMode = source.PrescriptionMode,
        PrescriptionValue = source.PrescriptionValue,
        WeightUnit = source.WeightUnit,
        TargetEstimatedOneRepMaxKg = ResolveOneRepMax(athlete, source.ExerciseType)
    };

    private static decimal ResolveTargetLoad(ProgramTemplateExercise source, AthleteProfile athlete) => source.PrescriptionMode switch
    {
        TemplatePrescriptionMode.PercentageOfOneRepMax => ResolveOneRepMax(athlete, source.ExerciseType) * source.PrescriptionValue / 100m,
        TemplatePrescriptionMode.ExactLoad when source.WeightUnit == "lb" => source.PrescriptionValue * 0.45359237m,
        TemplatePrescriptionMode.ExactLoad => source.PrescriptionValue,
        _ => 0m
    };

    private static decimal ResolveTargetLoad(TemplatePrescriptionMode prescriptionMode, decimal prescriptionValue, string weightUnit, AthleteProfile athlete, ExerciseType exerciseType) => prescriptionMode switch
    {
        TemplatePrescriptionMode.PercentageOfOneRepMax => ResolveOneRepMax(athlete, exerciseType) * prescriptionValue / 100m,
        TemplatePrescriptionMode.ExactLoad when weightUnit == "lb" => prescriptionValue * 0.45359237m,
        TemplatePrescriptionMode.ExactLoad => prescriptionValue,
        _ => 0m
    };

    private static decimal ResolveOneRepMax(AthleteProfile athlete, ExerciseType exerciseType) => exerciseType switch
    {
        ExerciseType.Squat => athlete.SquatOneRepMaxKg,
        ExerciseType.BenchPress => athlete.BenchOneRepMaxKg,
        ExerciseType.Deadlift => athlete.DeadliftOneRepMaxKg,
        _ => 0m
    };

    private static bool IsValidPrescription(TemplatePrescriptionMode mode, decimal value) => mode switch
    {
        TemplatePrescriptionMode.Rpe => value is >= 1m and <= 10m,
        TemplatePrescriptionMode.PercentageOfOneRepMax => value is > 0m and <= 100m,
        TemplatePrescriptionMode.ExactLoad => value is >= 0m and <= 1_000m,
        _ => false
    };

    private static void AdjustLiveSets(PrescribedExercise exercise, int desiredSetCount, int repetitions, TemplatePrescriptionMode prescriptionMode, decimal prescriptionValue, string weightUnit, AthleteProfile athlete)
    {
        var existingSets = exercise.Sets.OrderBy(set => set.SetNumber).ToList();
        var targetLoadKg = ResolveTargetLoad(prescriptionMode, prescriptionValue, weightUnit, athlete, exercise.ExerciseType);
        foreach (var set in existingSets.Take(desiredSetCount))
        {
            if (set.CompletionStatus == SetCompletionStatus.Skipped && set.CompletedAt is null && set.ActualLoadKg is null && set.ActualRepetitions is null)
            {
                set.CompletionStatus = SetCompletionStatus.Pending;
            }
            set.TargetRepetitions = repetitions;
            set.TargetRpe = prescriptionMode == TemplatePrescriptionMode.Rpe ? prescriptionValue : 0m;
            set.TargetLoadKg = targetLoadKg;
            set.TargetEstimatedOneRepMaxKg = ResolveOneRepMax(athlete, exercise.ExerciseType);
            set.UpdatedAt = DateTimeOffset.UtcNow;
        }
        foreach (var set in existingSets.Skip(desiredSetCount))
        {
            if (set.CompletionStatus == SetCompletionStatus.Pending)
            {
                set.CompletionStatus = SetCompletionStatus.Skipped;
                set.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }
        for (var setNumber = existingSets.Count + 1; setNumber <= desiredSetCount; setNumber++)
        {
            exercise.Sets.Add(new TrainingSet { SetNumber = setNumber, Intent = SetIntent.Working, TargetRepetitions = repetitions, TargetLoadKg = targetLoadKg, TargetRpe = prescriptionMode == TemplatePrescriptionMode.Rpe ? prescriptionValue : 0m, TargetEstimatedOneRepMaxKg = ResolveOneRepMax(athlete, exercise.ExerciseType), CompletionStatus = SetCompletionStatus.Pending });
        }
    }
}