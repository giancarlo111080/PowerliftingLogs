using System.Text.Json;
using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Infrastructure.Services;

public sealed record SyncCommandOutcome(Guid CommandId, SyncCommandStatus Status, string? RejectionReason);
public sealed record SyncActor(Guid UserId, string DisplayName, bool IsCoach);

public sealed class WorkoutSyncService(
    TrainingDbContext database,
    IGamificationService gamificationService,
    IValidator<LoggedSetRequest> loggedSetValidator,
    InstagramVideoUrlPolicy instagramVideoUrlPolicy)
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    public async Task<IReadOnlyList<SyncCommandOutcome>> ProcessAsync(
        IEnumerable<SyncCommandRequest> commands,
        SyncActor actor,
        CancellationToken cancellationToken)
    {
        var outcomes = new List<SyncCommandOutcome>();

        foreach (var command in commands.OrderBy(item => item.CreatedAt))
        {
            outcomes.Add(await ProcessOneAsync(command, actor, cancellationToken));
        }

        return outcomes;
    }

    private async Task<SyncCommandOutcome> ProcessOneAsync(SyncCommandRequest command, SyncActor actor, CancellationToken cancellationToken)
    {
        var existing = await database.SyncCommands
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.CommandId == command.CommandId, cancellationToken);
        if (existing is not null)
        {
            if (existing.AthleteProfileId != command.AthleteProfileId)
            {
                return new SyncCommandOutcome(command.CommandId, SyncCommandStatus.Rejected, "The command ID is already used by another athlete.");
            }
            return new SyncCommandOutcome(existing.CommandId, existing.Status, existing.RejectionReason);
        }

        await using var transaction = database.Database.IsRelational()
            ? await database.Database.BeginTransactionAsync(cancellationToken)
            : null;
        try
        {
            var storedCommand = new SyncCommand
            {
                CommandId = command.CommandId,
                AthleteProfileId = command.AthleteProfileId,
                AggregateId = command.AggregateId,
                CommandType = command.CommandType,
                PayloadJson = command.PayloadJson,
                DeviceId = command.DeviceId,
                Status = SyncCommandStatus.Pending
            };
            database.SyncCommands.Add(storedCommand);

            switch (command.CommandType)
            {
                case "log-set":
                case "skip-set":
                case "reset-set":
                    await ApplyLoggedSetAsync(command, cancellationToken);
                    break;
                case "attach-instagram-video":
                    await ApplyInstagramVideoLinkAsync(command, cancellationToken);
                    break;
                case "add-comment":
                    await ApplyCommentAsync(command, actor, cancellationToken);
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported sync command type '{command.CommandType}'.");
            }

            storedCommand.Status = SyncCommandStatus.Processed;
            storedCommand.ProcessedAt = DateTimeOffset.UtcNow;
            await database.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
            return new SyncCommandOutcome(command.CommandId, storedCommand.Status, null);
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or DbUpdateException)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }
            database.ChangeTracker.Clear();

            var duplicate = await database.SyncCommands.AsNoTracking()
                .SingleOrDefaultAsync(item => item.CommandId == command.CommandId, cancellationToken);
            if (duplicate is not null)
            {
                return new SyncCommandOutcome(duplicate.CommandId, duplicate.Status, duplicate.RejectionReason);
            }

            var rejectionReason = exception switch
            {
                JsonException => "The sync command payload is invalid.",
                DbUpdateConcurrencyException => "The training data changed in another request. Refresh and try again.",
                DbUpdateException => "The sync command conflicts with the current training data.",
                _ => exception.Message
            };
            var rejected = new SyncCommand
            {
                CommandId = command.CommandId,
                AthleteProfileId = command.AthleteProfileId,
                AggregateId = command.AggregateId,
                CommandType = command.CommandType,
                PayloadJson = command.PayloadJson,
                DeviceId = command.DeviceId,
                Status = SyncCommandStatus.Rejected,
                ProcessedAt = DateTimeOffset.UtcNow,
                RejectionReason = rejectionReason[..Math.Min(rejectionReason.Length, 1_000)]
            };
            database.SyncCommands.Add(rejected);
            await database.SaveChangesAsync(cancellationToken);
            return new SyncCommandOutcome(command.CommandId, rejected.Status, rejected.RejectionReason);
        }
    }

    private async Task ApplyLoggedSetAsync(SyncCommandRequest command, CancellationToken cancellationToken)
    {
        var request = Deserialize<LoggedSetRequest>(command.PayloadJson);
        if (request.IdempotencyKey != command.CommandId || request.TrainingSetId != command.AggregateId || request.AthleteProfileId != command.AthleteProfileId)
        {
            throw new InvalidOperationException("The logged set identity does not match the sync command.");
        }
        var expectedCommandType = request.CompletionStatus switch
        {
            SetCompletionStatus.Done => "log-set",
            SetCompletionStatus.Skipped => "skip-set",
            _ => "reset-set"
        };
        if (command.CommandType != expectedCommandType)
        {
            throw new InvalidOperationException("The logged set status does not match the sync command type.");
        }
        var validation = await loggedSetValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            throw new InvalidOperationException(string.Join(" ", validation.Errors.Select(error => error.ErrorMessage).Distinct()));
        }

        var trainingSet = await database.TrainingSets
            .Include(set => set.PrescribedExercise)
            .ThenInclude(exercise => exercise!.TrainingDay)
            .ThenInclude(day => day!.TrainingWeek)
            .ThenInclude(week => week!.TrainingBlock)
            .SingleOrDefaultAsync(set => set.Id == request.TrainingSetId
                && set.PrescribedExercise!.TrainingDay!.TrainingWeek!.TrainingBlock!.AthleteProfileId == command.AthleteProfileId, cancellationToken)
            ?? throw new InvalidOperationException("The training set was not found.");
        if (trainingSet.PrescribedExercise?.TrainingDay is null)
        {
            throw new InvalidOperationException("The training set hierarchy is incomplete.");
        }

        var athlete = await database.AthleteProfiles
            .SingleOrDefaultAsync(profile => profile.Id == request.AthleteProfileId, cancellationToken)
            ?? throw new InvalidOperationException("The athlete profile was not found.");

        var wasCompleted = trainingSet.CompletionStatus == SetCompletionStatus.Done;
        var wasRewarded = trainingSet.CompletedAt is not null;
        var previousTonnage = wasCompleted
            ? (trainingSet.ActualLoadKg ?? 0m) * (trainingSet.ActualRepetitions ?? 0)
            : 0m;
        trainingSet.CompletionStatus = request.CompletionStatus;
        trainingSet.ActualLoadKg = request.CompletionStatus == SetCompletionStatus.Done ? request.ActualLoadKg : null;
        trainingSet.ActualRepetitions = request.CompletionStatus == SetCompletionStatus.Done ? request.ActualRepetitions : null;
        trainingSet.ActualRpe = request.CompletionStatus == SetCompletionStatus.Done ? request.ActualRpe : null;
        var derivedOneRepMax = request.CompletionStatus == SetCompletionStatus.Done && request.ActualRepetitions > 0 && request.ActualLoadKg is decimal loadKg
            ? Math.Min(1_200m, loadKg * (1m + (request.ActualRepetitions.Value + Math.Max(0m, 10m - (request.ActualRpe ?? 10m))) / 30m))
            : (decimal?)null;
        trainingSet.ActualEstimatedOneRepMaxKg = request.CompletionStatus == SetCompletionStatus.Done ? request.ActualEstimatedOneRepMaxKg ?? derivedOneRepMax : null;
        trainingSet.ActualEffortPercentage = request.CompletionStatus == SetCompletionStatus.Done
            ? request.ActualEffortPercentage ?? (derivedOneRepMax is > 0m ? Math.Clamp(request.ActualLoadKg!.Value / derivedOneRepMax.Value, 0.10m, 1m) : null)
            : null;
        trainingSet.MeanVelocityMps = request.CompletionStatus == SetCompletionStatus.Done ? request.MeanVelocityMps : null;
        trainingSet.RestSeconds = request.CompletionStatus == SetCompletionStatus.Pending ? null : request.RestSeconds;
        trainingSet.OutcomeReason = request.CompletionStatus == SetCompletionStatus.Skipped ? request.OutcomeReason : null;
        trainingSet.InstagramVideoUrl = request.InstagramVideoUrl;
        trainingSet.AthleteNote = request.AthleteNote;
        if (request.CompletionStatus == SetCompletionStatus.Done && trainingSet.CompletedAt is null)
        {
            trainingSet.CompletedAt = DateTimeOffset.UtcNow;
        }
        else if (request.CompletionStatus == SetCompletionStatus.Pending)
        {
            trainingSet.CompletedAt = null;
        }
        trainingSet.UpdatedAt = DateTimeOffset.UtcNow;

        var currentTonnage = request.CompletionStatus == SetCompletionStatus.Done
            ? (request.ActualLoadKg ?? 0m) * (request.ActualRepetitions ?? 0)
            : 0m;
        athlete.CumulativeWorkingSetTonnageKg = Math.Max(0m,
            athlete.CumulativeWorkingSetTonnageKg - previousTonnage + currentTonnage);

        if (request.CompletionStatus == SetCompletionStatus.Done && request.ActualRepetitions > 0 && !wasRewarded)
        {
            var isPersonalRecord = request.ActualEstimatedOneRepMaxKg is > 0m
                && request.ActualEstimatedOneRepMaxKg > ResolveOneRepMax(athlete, trainingSet.PrescribedExercise.ExerciseType);
            gamificationService.AwardLoggedSet(athlete, trainingSet, isPersonalRecord);
        }
    }

    private async Task ApplyInstagramVideoLinkAsync(SyncCommandRequest command, CancellationToken cancellationToken)
    {
        var request = Deserialize<InstagramVideoLinkRequest>(command.PayloadJson);
        if (request.TrainingSetId != command.AggregateId)
        {
            throw new InvalidOperationException("The Instagram video identity does not match the sync command.");
        }
        if (string.IsNullOrWhiteSpace(request.InstagramVideoUrl) || request.InstagramVideoUrl.Length > 2_048 || !instagramVideoUrlPolicy.IsAllowed(request.InstagramVideoUrl)
            || request.AthleteNote?.Length > 2_000 || request.CoachFormFlags?.Length > 2_000)
        {
            throw new InvalidOperationException("The Instagram video link or notes are invalid.");
        }

        var trainingSet = await database.TrainingSets
            .Include(set => set.PrescribedExercise)
            .ThenInclude(exercise => exercise!.TrainingDay)
            .ThenInclude(day => day!.TrainingWeek)
            .ThenInclude(week => week!.TrainingBlock)
            .SingleOrDefaultAsync(set => set.Id == request.TrainingSetId
                && set.PrescribedExercise!.TrainingDay!.TrainingWeek!.TrainingBlock!.AthleteProfileId == command.AthleteProfileId, cancellationToken)
            ?? throw new InvalidOperationException("The training set was not found.");
        trainingSet.InstagramVideoUrl = request.InstagramVideoUrl.Trim();
        trainingSet.AthleteNote = request.AthleteNote;
        trainingSet.CoachFormFlags = request.CoachFormFlags;
        trainingSet.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private async Task ApplyCommentAsync(SyncCommandRequest command, SyncActor actor, CancellationToken cancellationToken)
    {
        var request = Deserialize<CommentRequest>(command.PayloadJson);
        if (request.AthleteProfileId != command.AthleteProfileId)
        {
            throw new InvalidOperationException("The comment athlete does not match the sync command.");
        }
        var targetId = request.ContextType switch
        {
            CommentContextType.TrainingDay when request.TrainingDayId is Guid id && request.PrescribedExerciseId is null && request.TrainingSetId is null => id,
            CommentContextType.Exercise when request.TrainingDayId is null && request.PrescribedExerciseId is Guid id && request.TrainingSetId is null => id,
            CommentContextType.Set when request.TrainingDayId is null && request.PrescribedExerciseId is null && request.TrainingSetId is Guid id => id,
            _ => Guid.Empty
        };
        if (targetId == Guid.Empty || targetId != command.AggregateId
            || string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Trim().Length > 200
            || string.IsNullOrWhiteSpace(request.Message) || request.Message.Trim().Length > 5_000)
        {
            throw new InvalidOperationException("The comment context, subject, or message is invalid.");
        }
        var contextExists = request.ContextType switch
        {
            CommentContextType.TrainingDay when request.TrainingDayId is Guid trainingDayId => await database.TrainingDays.AnyAsync(day => day.Id == trainingDayId && day.TrainingWeek!.TrainingBlock!.AthleteProfileId == command.AthleteProfileId, cancellationToken),
            CommentContextType.Exercise when request.PrescribedExerciseId is Guid exerciseId => await database.PrescribedExercises.AnyAsync(exercise => exercise.Id == exerciseId && exercise.TrainingDay!.TrainingWeek!.TrainingBlock!.AthleteProfileId == command.AthleteProfileId, cancellationToken),
            CommentContextType.Set when request.TrainingSetId is Guid trainingSetId => await database.TrainingSets.AnyAsync(set => set.Id == trainingSetId && set.PrescribedExercise!.TrainingDay!.TrainingWeek!.TrainingBlock!.AthleteProfileId == command.AthleteProfileId, cancellationToken),
            _ => false
        };
        if (!contextExists)
        {
            throw new InvalidOperationException("The comment target was not found for this athlete.");
        }
        var thread = new CommentThread
        {
            AthleteProfileId = request.AthleteProfileId,
            TrainingDayId = request.TrainingDayId,
            PrescribedExerciseId = request.PrescribedExerciseId,
            TrainingSetId = request.TrainingSetId,
            ContextType = request.ContextType,
            Subject = request.Subject.Trim()
        };
        thread.Comments.Add(new ThreadComment
        {
            AuthorUserId = actor.UserId.ToString(),
            AuthorDisplayName = actor.DisplayName,
            Message = request.Message.Trim(),
            IsCoachComment = actor.IsCoach
        });
        database.CommentThreads.Add(thread);
    }

    private static T Deserialize<T>(string payloadJson) =>
        JsonSerializer.Deserialize<T>(payloadJson, JsonOptions)
        ?? throw new JsonException("Sync command payload is empty.");

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    private static decimal ResolveOneRepMax(AthleteProfile athlete, ExerciseType exerciseType) => exerciseType switch
    {
        ExerciseType.Squat => athlete.SquatOneRepMaxKg,
        ExerciseType.BenchPress => athlete.BenchOneRepMaxKg,
        ExerciseType.Deadlift => athlete.DeadliftOneRepMaxKg,
        _ => decimal.MaxValue
    };
}
