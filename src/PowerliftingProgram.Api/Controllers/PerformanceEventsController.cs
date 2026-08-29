using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record AppendPerformanceEventRequest(
    PerformanceEventKind Kind,
    DateTimeOffset? OccurredAtUtc,
    string Source,
    int SchemaVersion,
    string Provenance,
    JsonElement Payload,
    Guid? CorrelationId,
    string? StableKey);

public sealed record PerformanceEventResponse(
    Guid Id,
    Guid TenantId,
    Guid AthleteProfileId,
    Guid? ActorUserId,
    PerformanceEventKind Kind,
    DateTimeOffset OccurredAtUtc,
    string Source,
    int SchemaVersion,
    string Provenance,
    JsonElement Payload,
    Guid? CorrelationId,
    string? StableKey,
    DateTimeOffset CreatedAt);

public sealed record PerformanceExportResponse(
    Guid AthleteProfileId,
    DateTimeOffset ExportedAtUtc,
    int SchemaVersion,
    IReadOnlyList<PerformanceEventResponse> Events);

[Authorize]
[ApiController]
[Route("api/performance")]
public sealed class PerformanceEventsController(
    TrainingDbContext database,
    CoachAccessService coachAccessService,
    ILogger<PerformanceEventsController>? logger = null) : ControllerBase
{
    private const int MaximumPayloadLength = 128 * 1024;

    [HttpGet("athletes/{athleteProfileId:guid}/events")]
    [ProducesResponseType(typeof(IReadOnlyList<PerformanceEventResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PerformanceEventResponse>>> GetEvents(
        Guid athleteProfileId,
        [FromQuery] PerformanceEventKind? kind,
        [FromQuery] DateTimeOffset? sinceUtc,
        [FromQuery] int take = 250,
        CancellationToken cancellationToken = default)
    {
        var access = await ResolveAccessAsync(athleteProfileId, cancellationToken);
        if (access is null)
        {
            logger?.LogWarning("Performance event read denied for athlete {AthleteProfileId}", athleteProfileId);
            return Forbid();
        }
        await using var tenantScope = await BeginTenantScopeAsync(access.TenantId, cancellationToken);

        var query = database.PerformanceEvents.AsNoTracking()
            .Where(performanceEvent => performanceEvent.TenantId == access.TenantId
                && performanceEvent.AthleteProfileId == athleteProfileId);
        if (kind is not null)
        {
            query = query.Where(performanceEvent => performanceEvent.Kind == kind);
        }
        if (sinceUtc is not null)
        {
            query = query.Where(performanceEvent => performanceEvent.OccurredAtUtc >= sinceUtc.Value.ToUniversalTime());
        }

        var events = await query
            .OrderByDescending(performanceEvent => performanceEvent.OccurredAtUtc)
            .ThenByDescending(performanceEvent => performanceEvent.CreatedAt)
            .Take(Math.Clamp(take, 1, 500))
            .ToListAsync(cancellationToken);
        logger?.LogInformation("Performance event read by actor {ActorUserId} in tenant {TenantId} for athlete {AthleteProfileId}: {EventCount} events", access.Actor.Id, access.TenantId, athleteProfileId, events.Count);
        return Ok(events.Select(ToResponse).ToList());
    }

    [HttpPost("athletes/{athleteProfileId:guid}/events")]
    [ProducesResponseType(typeof(PerformanceEventResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(PerformanceEventResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PerformanceEventResponse>> AppendEvent(
        Guid athleteProfileId,
        [FromBody] AppendPerformanceEventRequest request,
        CancellationToken cancellationToken)
    {
        var access = await ResolveAccessAsync(athleteProfileId, cancellationToken);
        if (access is null || !CanAppend(access.IsCoachContext, request.Kind))
        {
            logger?.LogWarning("Performance event append denied for athlete {AthleteProfileId}, kind {EventKind}", athleteProfileId, request.Kind);
            return Forbid();
        }

        ValidateRequest(request, athleteProfileId, access.Actor.Id);
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }
        await using var tenantScope = await BeginTenantScopeAsync(access.TenantId, cancellationToken);

        var stableKey = string.IsNullOrWhiteSpace(request.StableKey) ? null : request.StableKey.Trim();
        if (stableKey is not null)
        {
            var existing = await database.PerformanceEvents.AsNoTracking().SingleOrDefaultAsync(
                performanceEvent => performanceEvent.TenantId == access.TenantId && performanceEvent.StableKey == stableKey,
                cancellationToken);
            if (existing is not null)
            {
                logger?.LogInformation("Performance event replay accepted for actor {ActorUserId} in tenant {TenantId}, athlete {AthleteProfileId}, kind {EventKind}, event {PerformanceEventId}", access.Actor.Id, access.TenantId, athleteProfileId, request.Kind, existing.Id);
                return Ok(ToResponse(existing));
            }
        }

        var now = DateTimeOffset.UtcNow;
        var performanceEvent = new PerformanceEvent
        {
            TenantId = access.TenantId,
            AthleteProfileId = athleteProfileId,
            ActorUserId = access.Actor.Id,
            Kind = request.Kind,
            OccurredAtUtc = (request.OccurredAtUtc ?? now).ToUniversalTime(),
            Source = request.Source.Trim(),
            SchemaVersion = request.SchemaVersion,
            Provenance = request.Provenance.Trim(),
            PayloadJson = request.Payload.GetRawText(),
            CorrelationId = request.CorrelationId,
            StableKey = stableKey
        };
        database.PerformanceEvents.Add(performanceEvent);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException) when (stableKey is not null)
        {
            database.Entry(performanceEvent).State = EntityState.Detached;
            var existing = await database.PerformanceEvents.AsNoTracking().SingleOrDefaultAsync(
                candidate => candidate.TenantId == access.TenantId && candidate.StableKey == stableKey,
                cancellationToken);
            if (existing is not null)
            {
                logger?.LogInformation("Concurrent performance event replay accepted for actor {ActorUserId} in tenant {TenantId}, athlete {AthleteProfileId}, kind {EventKind}, event {PerformanceEventId}", access.Actor.Id, access.TenantId, athleteProfileId, request.Kind, existing.Id);
                return Ok(ToResponse(existing));
            }
            throw;
        }

        logger?.LogInformation("Performance event appended by actor {ActorUserId} in tenant {TenantId} for athlete {AthleteProfileId}, kind {EventKind}, event {PerformanceEventId}", access.Actor.Id, access.TenantId, athleteProfileId, request.Kind, performanceEvent.Id);
        return CreatedAtAction(nameof(GetEvents), new { athleteProfileId }, ToResponse(performanceEvent));
    }

    [HttpGet("athletes/{athleteProfileId:guid}/export")]
    [ProducesResponseType(typeof(PerformanceExportResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<PerformanceExportResponse>> Export(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        var access = await ResolveAccessAsync(athleteProfileId, cancellationToken);
        if (access is null)
        {
            logger?.LogWarning("Performance export denied for athlete {AthleteProfileId}", athleteProfileId);
            return Forbid();
        }
        await using var tenantScope = await BeginTenantScopeAsync(access.TenantId, cancellationToken);

        var events = await database.PerformanceEvents.AsNoTracking()
            .Where(performanceEvent => performanceEvent.TenantId == access.TenantId
                && performanceEvent.AthleteProfileId == athleteProfileId)
            .OrderBy(performanceEvent => performanceEvent.OccurredAtUtc)
            .ThenBy(performanceEvent => performanceEvent.CreatedAt)
            .ToListAsync(cancellationToken);
        logger?.LogInformation("Performance export created by actor {ActorUserId} in tenant {TenantId} for athlete {AthleteProfileId}: {EventCount} events", access.Actor.Id, access.TenantId, athleteProfileId, events.Count);
        return Ok(new PerformanceExportResponse(athleteProfileId, DateTimeOffset.UtcNow, 1, events.Select(ToResponse).ToList()));
    }

    [HttpDelete("athletes/{athleteProfileId:guid}/events")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteEvents(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        var access = await ResolveAccessAsync(athleteProfileId, cancellationToken);
        if (access is null || access.IsCoachContext || access.Actor.AthleteProfile?.Id != athleteProfileId)
        {
            logger?.LogWarning("Performance event deletion denied for athlete {AthleteProfileId}", athleteProfileId);
            return Forbid();
        }
        await using var tenantScope = await BeginTenantScopeAsync(access.TenantId, cancellationToken);

        var events = await database.PerformanceEvents
            .Where(performanceEvent => performanceEvent.TenantId == access.TenantId
                && performanceEvent.AthleteProfileId == athleteProfileId)
            .ToListAsync(cancellationToken);
        database.PerformanceEvents.RemoveRange(events);
        await database.SaveChangesAsync(cancellationToken);
        logger?.LogInformation("Performance event stream deleted by athlete actor {ActorUserId} in tenant {TenantId} for athlete {AthleteProfileId}: {EventCount} events", access.Actor.Id, access.TenantId, athleteProfileId, events.Count);
        return NoContent();
    }

    private void ValidateRequest(AppendPerformanceEventRequest request, Guid athleteProfileId, Guid actorUserId)
    {
        if (string.IsNullOrWhiteSpace(request.Source) || request.Source.Length > 80)
        {
            ModelState.AddModelError(nameof(request.Source), "Source is required and must be 80 characters or fewer.");
        }
        if (string.IsNullOrWhiteSpace(request.Provenance) || request.Provenance.Length > 500)
        {
            ModelState.AddModelError(nameof(request.Provenance), "Provenance is required and must be 500 characters or fewer.");
        }
        if (request.SchemaVersion is < 1 or > 10)
        {
            ModelState.AddModelError(nameof(request.SchemaVersion), "Schema version must be between 1 and 10.");
        }
        if (request.Payload.ValueKind != JsonValueKind.Object || Encoding.UTF8.GetByteCount(request.Payload.GetRawText()) > MaximumPayloadLength)
        {
            ModelState.AddModelError(nameof(request.Payload), "Payload must be a JSON object no larger than 128 KB.");
        }
        else
        {
            foreach (var (field, message) in PerformanceEventPayloadValidator.Validate(request.Kind, request.Payload, athleteProfileId, actorUserId))
            {
                ModelState.AddModelError(field, message);
            }
        }
        if (request.OccurredAtUtc > DateTimeOffset.UtcNow.AddMinutes(5))
        {
            ModelState.AddModelError(nameof(request.OccurredAtUtc), "Occurrence time cannot be more than five minutes in the future.");
        }
        if (request.StableKey?.Length > 160)
        {
            ModelState.AddModelError(nameof(request.StableKey), "Stable key must be 160 characters or fewer.");
        }
    }

    private async Task<PerformanceAccess?> ResolveAccessAsync(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        var actorId = CoachAccessService.CurrentUserId(User);
        if (actorId is null)
        {
            return null;
        }

        var actor = await database.PlatformUsers.AsNoTracking().Include(user => user.AthleteProfile)
            .SingleOrDefaultAsync(user => user.Id == actorId, cancellationToken);
        if (actor is null)
        {
            return null;
        }
        if (actor.AthleteProfile?.Id == athleteProfileId)
        {
            return new PerformanceAccess(actor.CoachId ?? actor.Id, actor, false);
        }
        if (actor.CanCoach && await coachAccessService.CoachOwnsAthleteAsync(actor.Id, athleteProfileId, cancellationToken))
        {
            return new PerformanceAccess(actor.Id, actor, true);
        }
        return null;
    }

    private async Task<IAsyncDisposable?> BeginTenantScopeAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (database.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) != true)
        {
            return null;
        }

        await database.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await database.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.tenant_id', {tenantId.ToString()}, false)",
                cancellationToken);
            return new TenantDatabaseScope(database);
        }
        catch
        {
            await database.Database.CloseConnectionAsync();
            throw;
        }
    }

    private static bool CanAppend(bool isCoachContext, PerformanceEventKind kind) => isCoachContext switch
    {
        false => kind is PerformanceEventKind.RecoveryCheckIn
            or PerformanceEventKind.TechniqueObservation
            or PerformanceEventKind.CompetitionPlan
            or PerformanceEventKind.CompetitionAttempt
            or PerformanceEventKind.CompetitionResult
            or PerformanceEventKind.ConsentGrant
            or PerformanceEventKind.VideoAnnotation,
        true => kind is PerformanceEventKind.TechniqueObservation
            or PerformanceEventKind.Recommendation
            or PerformanceEventKind.CoachDecision
            or PerformanceEventKind.ProgramVersion
            or PerformanceEventKind.CompetitionPlan
            or PerformanceEventKind.CompetitionAttempt
            or PerformanceEventKind.CompetitionResult
            or PerformanceEventKind.ModelPrediction
            or PerformanceEventKind.VideoAnnotation
            or PerformanceEventKind.AthleteGroup
            or PerformanceEventKind.ExerciseLibraryItem
            or PerformanceEventKind.ExceptionDisposition
    };

    private static PerformanceEventResponse ToResponse(PerformanceEvent performanceEvent)
    {
        using var payload = JsonDocument.Parse(performanceEvent.PayloadJson);
        return new PerformanceEventResponse(
            performanceEvent.Id,
            performanceEvent.TenantId,
            performanceEvent.AthleteProfileId,
            performanceEvent.ActorUserId,
            performanceEvent.Kind,
            performanceEvent.OccurredAtUtc,
            performanceEvent.Source,
            performanceEvent.SchemaVersion,
            performanceEvent.Provenance,
            payload.RootElement.Clone(),
            performanceEvent.CorrelationId,
            performanceEvent.StableKey,
            performanceEvent.CreatedAt);
    }

    private sealed record PerformanceAccess(Guid TenantId, PlatformUser Actor, bool IsCoachContext);

    private sealed class TenantDatabaseScope(TrainingDbContext database) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            try
            {
                await database.Database.ExecuteSqlRawAsync("RESET app.tenant_id");
            }
            finally
            {
                await database.Database.CloseConnectionAsync();
            }
        }
    }
}