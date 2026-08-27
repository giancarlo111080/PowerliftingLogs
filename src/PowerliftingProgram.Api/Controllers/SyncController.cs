using System.Security.Claims;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/sync")]
public sealed class SyncController(
    IValidator<SyncCommandRequest> validator,
    WorkoutSyncService workoutSyncService,
    CoachAccessService coachAccessService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(IReadOnlyList<SyncCommandOutcome>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<SyncCommandOutcome>>> Synchronize(
        [FromBody] IReadOnlyList<SyncCommandRequest> commands,
        CancellationToken cancellationToken)
    {
        if (commands.Count is 0 or > 100)
        {
            ModelState.AddModelError(nameof(commands), "A sync batch must contain between 1 and 100 commands.");
            return ValidationProblem(ModelState);
        }
        var actor = CurrentActor();
        if (actor is null)
        {
            return Unauthorized();
        }
        if (!await CanAccessAllAthletes(commands.Select(command => command.AthleteProfileId), cancellationToken))
        {
            return Forbid();
        }

        foreach (var command in commands)
        {
            var validation = await validator.ValidateAsync(command, cancellationToken);
            if (!validation.IsValid)
            {
                AddValidationErrors(validation);
            }
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        return Ok(await workoutSyncService.ProcessAsync(commands, actor, cancellationToken));
    }

    [HttpPost("logged-set")]
    [ProducesResponseType(typeof(SyncCommandOutcome), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SyncCommandOutcome>> LogSet(
        [FromBody] LoggedSetRequest request,
        [FromServices] IValidator<LoggedSetRequest> loggedSetValidator,
        CancellationToken cancellationToken)
    {
        var actor = CurrentActor();
        if (actor is null)
        {
            return Unauthorized();
        }
        if (!await coachAccessService.CanAccessAthleteAsync(User, request.AthleteProfileId, cancellationToken))
        {
            return Forbid();
        }
        var validation = await loggedSetValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            AddValidationErrors(validation);
            return ValidationProblem(ModelState);
        }

        var commandType = request.CompletionStatus == Domain.Entities.SetCompletionStatus.Skipped ? "skip-set" : "log-set";
        var command = new SyncCommandRequest(
            request.IdempotencyKey,
            request.AthleteProfileId,
            request.TrainingSetId,
            commandType,
            JsonSerializer.Serialize(request),
            Request.Headers.UserAgent.ToString() is { Length: > 0 } deviceId ? deviceId[..Math.Min(128, deviceId.Length)] : "api-client",
            DateTimeOffset.UtcNow);
        var outcome = (await workoutSyncService.ProcessAsync([command], actor, cancellationToken)).Single();
        return Ok(outcome);
    }

    private void AddValidationErrors(FluentValidation.Results.ValidationResult validation)
    {
        foreach (var error in validation.Errors)
        {
            ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
        }
    }

    private async Task<bool> CanAccessAllAthletes(IEnumerable<Guid> athleteProfileIds, CancellationToken cancellationToken)
    {
        foreach (var athleteProfileId in athleteProfileIds.Distinct())
        {
            if (!await coachAccessService.CanAccessAthleteAsync(User, athleteProfileId, cancellationToken))
            {
                return false;
            }
        }
        return true;
    }

    private SyncActor? CurrentActor()
    {
        var userId = CoachAccessService.CurrentUserId(User);
        var displayName = User.FindFirst(ClaimTypes.Name)?.Value;
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        return userId is Guid id && !string.IsNullOrWhiteSpace(displayName) && role is "COACH" or "ATHLETE"
            ? new SyncActor(id, displayName, role == "COACH")
            : null;
    }
}
