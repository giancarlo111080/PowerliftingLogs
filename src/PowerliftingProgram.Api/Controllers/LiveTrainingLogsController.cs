using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record LiveSetResponse(Guid Id, int SetNumber, int TargetRepetitions, decimal TargetLoadKg, decimal TargetRpe, SetCompletionStatus CompletionStatus, decimal? ActualLoadKg, int? ActualRepetitions, decimal? ActualRpe, decimal? MeanVelocityMps, int? RestSeconds, SetOutcomeReason? OutcomeReason, DateTimeOffset? CompletedAt, string? InstagramVideoUrl);
public sealed record LiveExerciseResponse(Guid Id, int SortOrder, string Name, ExerciseType ExerciseType, TemplatePrescriptionMode PrescriptionMode, decimal PrescriptionValue, string WeightUnit, IReadOnlyList<LiveSetResponse> Sets);
public sealed record LiveTrainingDayResponse(Guid Id, string Name, string Focus, DateOnly ScheduledFor, IReadOnlyList<LiveExerciseResponse> Exercises);
public sealed record LiveTrainingWeekResponse(Guid Id, int WeekNumber, DateOnly StartsOn, IReadOnlyList<LiveTrainingDayResponse> Days);
public sealed record LiveTrainingLogResponse(Guid Id, Guid AthleteProfileId, Guid? CoachId, Guid? ProgramTemplateId, string Name, string? Phase, string Goal, int TrainingDaysPerWeek, DateOnly StartsOn, DateOnly EndsOn, DateTimeOffset UpdatedAt, IReadOnlyList<LiveTrainingWeekResponse> Weeks);
public sealed record ProgramOfferResponse(Guid Id, string Name, string CoachName, string? Phase, string Goal, int TrainingDaysPerWeek, DateOnly StartsOn, DateOnly EndsOn, DateTimeOffset OfferedAt);

[Authorize]
[ApiController]
[Route("api/live-training")]
public sealed class LiveTrainingLogsController(TrainingDbContext database, CoachAccessService coachAccessService) : ControllerBase
{
    [HttpGet("current")]
    [ProducesResponseType(typeof(LiveTrainingLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
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
        var log = await LiveLogQuery().SingleOrDefaultAsync(block => block.AthleteProfileId == athleteProfileId && block.IsActive && block.Status == TrainingBlockStatus.Accepted, cancellationToken);
        return log is null ? new NoContentResult() : Ok(ToResponse(log));
    }

    [Authorize(Roles = "COACH")]
    [HttpGet("athletes/{athleteProfileId:guid}")]
    [ProducesResponseType(typeof(LiveTrainingLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<LiveTrainingLogResponse>> GetAthleteLog(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        if (!await coachAccessService.CanAccessAthleteAsync(User, athleteProfileId, cancellationToken))
        {
            return Forbid();
        }
        var log = await LiveLogQuery().SingleOrDefaultAsync(block => block.AthleteProfileId == athleteProfileId && block.IsActive && block.Status == TrainingBlockStatus.Accepted, cancellationToken);
        return log is null ? new NoContentResult() : Ok(ToResponse(log));
    }

    [HttpGet("offers")]
    [ProducesResponseType(typeof(IReadOnlyList<ProgramOfferResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ProgramOfferResponse>>> GetOffers(CancellationToken cancellationToken)
    {
        var athleteProfileId = await CurrentAthleteProfileIdAsync(cancellationToken);
        if (athleteProfileId is null)
        {
            return NotFound();
        }

        var offers = await database.TrainingBlocks.AsNoTracking()
            .Where(block => block.AthleteProfileId == athleteProfileId && block.Status == TrainingBlockStatus.Pending)
            .OrderByDescending(block => block.CreatedAt)
            .Select(block => new ProgramOfferResponse(
                block.Id,
                block.Name,
                block.Coach != null ? block.Coach.DisplayName : "Coach",
                block.ProgramTemplate != null ? block.ProgramTemplate.Phase : null,
                block.ProgramTemplate != null ? block.ProgramTemplate.Goal : block.Name,
                block.ProgramTemplate != null ? block.ProgramTemplate.TrainingDaysPerWeek : 1,
                block.StartsOn,
                block.EndsOn,
                block.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(offers);
    }

    [HttpPost("offers/{offerId:guid}/accept")]
    [ProducesResponseType(typeof(LiveTrainingLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LiveTrainingLogResponse>> AcceptOffer(Guid offerId, CancellationToken cancellationToken)
    {
        var offer = await FindOwnedPendingOfferAsync(offerId, cancellationToken);
        if (offer is null)
        {
            return NotFound();
        }

        var changedAt = DateTimeOffset.UtcNow;
        var currentBlocks = await database.TrainingBlocks
            .Where(block => block.AthleteProfileId == offer.AthleteProfileId && block.IsActive && block.Status == TrainingBlockStatus.Accepted)
            .ToListAsync(cancellationToken);
        foreach (var block in currentBlocks)
        {
            block.IsActive = false;
            block.Status = TrainingBlockStatus.Completed;
            block.UpdatedAt = changedAt;
        }
        offer.IsActive = true;
        offer.Status = TrainingBlockStatus.Accepted;
        offer.RespondedAt = changedAt;
        offer.UpdatedAt = changedAt;
        offer.AthleteProfile!.ActiveBlockTag = offer.Tag;
        offer.AthleteProfile.UpdatedAt = changedAt;
        await database.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(offer));
    }

    [HttpPost("blocks/{blockId:guid}/activate")]
    [ProducesResponseType(typeof(LiveTrainingLogResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LiveTrainingLogResponse>> ActivateBlock(Guid blockId, CancellationToken cancellationToken)
    {
        var athleteProfileId = await CurrentAthleteProfileIdAsync(cancellationToken);
        if (athleteProfileId is null)
        {
            return NotFound();
        }
        var selected = await LiveLogQuery(tracked: true).SingleOrDefaultAsync(block =>
            block.Id == blockId && block.AthleteProfileId == athleteProfileId &&
            (block.Status == TrainingBlockStatus.Accepted || block.Status == TrainingBlockStatus.Completed), cancellationToken);
        if (selected is null)
        {
            return NotFound();
        }

        var changedAt = DateTimeOffset.UtcNow;
        var activeBlocks = await database.TrainingBlocks
            .Where(block => block.AthleteProfileId == athleteProfileId && block.IsActive && block.Id != selected.Id)
            .ToListAsync(cancellationToken);
        foreach (var block in activeBlocks)
        {
            block.IsActive = false;
            block.Status = TrainingBlockStatus.Completed;
            block.UpdatedAt = changedAt;
        }
        selected.IsActive = true;
        selected.Status = TrainingBlockStatus.Accepted;
        selected.RespondedAt ??= changedAt;
        selected.UpdatedAt = changedAt;
        selected.AthleteProfile!.ActiveBlockTag = selected.Tag;
        selected.AthleteProfile.UpdatedAt = changedAt;
        await database.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(selected));
    }

    [Authorize(Roles = "COACH")]
    [HttpDelete("blocks/{blockId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveBlock(Guid blockId, CancellationToken cancellationToken)
    {
        var coachId = CoachAccessService.CurrentUserId(User);
        if (coachId is null)
        {
            return Unauthorized();
        }

        var block = await database.TrainingBlocks
            .Include(candidate => candidate.AthleteProfile)
            .SingleOrDefaultAsync(candidate => candidate.Id == blockId && candidate.CoachId == coachId, cancellationToken);
        if (block is null)
        {
            return NotFound();
        }

        var changedAt = DateTimeOffset.UtcNow;
        block.IsActive = false;
        block.Status = TrainingBlockStatus.Completed;
        block.UpdatedAt = changedAt;
        if (block.AthleteProfile?.ActiveBlockTag == block.Tag)
        {
            block.AthleteProfile.ActiveBlockTag = null;
            block.AthleteProfile.UpdatedAt = changedAt;
        }
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("offers/{offerId:guid}/decline")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeclineOffer(Guid offerId, CancellationToken cancellationToken)
    {
        var offer = await FindOwnedPendingOfferAsync(offerId, cancellationToken);
        if (offer is null)
        {
            return NotFound();
        }
        offer.Status = TrainingBlockStatus.Declined;
        offer.RespondedAt = DateTimeOffset.UtcNow;
        offer.UpdatedAt = offer.RespondedAt.Value;
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<Guid?> CurrentAthleteProfileIdAsync(CancellationToken cancellationToken)
    {
        var userId = CoachAccessService.CurrentUserId(User);
        if (userId is null)
        {
            return null;
        }
        return await database.AthleteProfiles.AsNoTracking()
            .Where(profile => profile.PlatformUserId == userId)
            .Select(profile => (Guid?)profile.Id)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<TrainingBlock?> FindOwnedPendingOfferAsync(Guid offerId, CancellationToken cancellationToken)
    {
        var athleteProfileId = await CurrentAthleteProfileIdAsync(cancellationToken);
        return athleteProfileId is null ? null : await LiveLogQuery(tracked: true).SingleOrDefaultAsync(block =>
            block.Id == offerId && block.AthleteProfileId == athleteProfileId && block.Status == TrainingBlockStatus.Pending,
            cancellationToken);
    }

    private IQueryable<TrainingBlock> LiveLogQuery(bool tracked = false)
    {
        var query = database.TrainingBlocks
            .Include(block => block.AthleteProfile)
            .Include(block => block.ProgramTemplate)
            .Include(block => block.Weeks).ThenInclude(week => week.Days).ThenInclude(day => day.Exercises).ThenInclude(exercise => exercise.Sets);
        return tracked ? query : query.AsNoTracking();
    }

    private static LiveTrainingLogResponse ToResponse(TrainingBlock block) => new(
        block.Id,
        block.AthleteProfileId,
        block.CoachId,
        block.ProgramTemplateId,
        block.Name,
        block.ProgramTemplate?.Phase,
        block.ProgramTemplate?.Goal ?? block.Name,
        block.ProgramTemplate?.TrainingDaysPerWeek ?? Math.Clamp(block.Weeks.SelectMany(week => week.Days).Count() / Math.Max(block.Weeks.Count, 1), 1, 7),
        block.StartsOn,
        block.EndsOn,
        block.UpdatedAt,
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
                        set.ActualRpe,
                        set.MeanVelocityMps,
                        set.RestSeconds,
                        set.OutcomeReason,
                        set.CompletedAt,
                        set.InstagramVideoUrl)).ToList())).ToList())).ToList())).ToList());
}