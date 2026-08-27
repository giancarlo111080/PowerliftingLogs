using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Infrastructure.Services;

public sealed record SyncCommandOutcome(Guid CommandId, SyncCommandStatus Status, string? RejectionReason);

public sealed class WorkoutSyncService(
    TrainingDbContext database,
    IGamificationService gamificationService)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<SyncCommandOutcome>> ProcessAsync(
        IEnumerable<SyncCommandRequest> commands,
        CancellationToken cancellationToken)
    {
        var outcomes = new List<SyncCommandOutcome>();

        foreach (var command in commands.OrderBy(item => item.CreatedAt))
        {
            outcomes.Add(await ProcessOneAsync(command, cancellationToken));
        }

        return outcomes;
    }

    private async Task<SyncCommandOutcome> ProcessOneAsync(SyncCommandRequest command, CancellationToken cancellationToken)
    {
        var existing = await database.SyncCommands
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.CommandId == command.CommandId, cancellationToken);
        if (existing is not null)
        {
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
                    await ApplyLoggedSetAsync(command, cancellationToken);
                    break;
                case "attach-instagram-video":
                    await ApplyInstagramVideoLinkAsync(command, cancellationToken);
                    break;
                case "add-comment":
                    ApplyComment(command);
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
                RejectionReason = exception.Message[..Math.Min(exception.Message.Length, 1_000)]
            };
            database.SyncCommands.Add(rejected);
            await database.SaveChangesAsync(cancellationToken);
            return new SyncCommandOutcome(command.CommandId, rejected.Status, rejected.RejectionReason);
        }
    }

    private async Task ApplyLoggedSetAsync(SyncCommandRequest command, CancellationToken cancellationToken)
    {
        var request = Deserialize<LoggedSetRequest>(command.PayloadJson);
        if (request.IdempotencyKey != command.CommandId || request.TrainingSetId != command.AggregateId)
        {
            throw new InvalidOperationException("The logged set identity does not match the sync command.");
        }

        var trainingSet = await database.TrainingSets
            .Include(set => set.PrescribedExercise)
            .ThenInclude(exercise => exercise!.TrainingDay)
            .SingleOrDefaultAsync(set => set.Id == request.TrainingSetId, cancellationToken)
            ?? throw new InvalidOperationException("The training set was not found.");
        if (trainingSet.PrescribedExercise?.TrainingDay is null)
        {
            throw new InvalidOperationException("The training set hierarchy is incomplete.");
        }

        var athlete = await database.AthleteProfiles
            .SingleOrDefaultAsync(profile => profile.Id == request.AthleteProfileId, cancellationToken)
            ?? throw new InvalidOperationException("The athlete profile was not found.");

        trainingSet.CompletionStatus = request.CompletionStatus;
        trainingSet.ActualLoadKg = request.ActualLoadKg;
        trainingSet.ActualRepetitions = request.ActualRepetitions;
        trainingSet.ActualRpe = request.ActualRpe;
        trainingSet.ActualEstimatedOneRepMaxKg = request.ActualEstimatedOneRepMaxKg;
        trainingSet.ActualEffortPercentage = request.ActualEffortPercentage;
        trainingSet.InstagramVideoUrl = request.InstagramVideoUrl;
        trainingSet.AthleteNote = request.AthleteNote;
        trainingSet.CompletedAt = request.CompletionStatus == SetCompletionStatus.Done ? DateTimeOffset.UtcNow : null;
        trainingSet.UpdatedAt = DateTimeOffset.UtcNow;

        if (request.CompletionStatus == SetCompletionStatus.Done)
        {
            athlete.CumulativeWorkingSetTonnageKg += (request.ActualLoadKg ?? 0m) * (request.ActualRepetitions ?? 0);
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

        var trainingSet = await database.TrainingSets.SingleOrDefaultAsync(set => set.Id == request.TrainingSetId, cancellationToken)
            ?? throw new InvalidOperationException("The training set was not found.");
        trainingSet.InstagramVideoUrl = request.InstagramVideoUrl;
        trainingSet.AthleteNote = request.AthleteNote;
        trainingSet.CoachFormFlags = request.CoachFormFlags;
        trainingSet.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private void ApplyComment(SyncCommandRequest command)
    {
        var request = Deserialize<CommentRequest>(command.PayloadJson);
        var thread = new CommentThread
        {
            AthleteProfileId = request.AthleteProfileId,
            TrainingDayId = request.TrainingDayId,
            PrescribedExerciseId = request.PrescribedExerciseId,
            TrainingSetId = request.TrainingSetId,
            ContextType = request.ContextType,
            Subject = request.Subject
        };
        thread.Comments.Add(new ThreadComment
        {
            AuthorUserId = request.AuthorUserId,
            AuthorDisplayName = request.AuthorDisplayName,
            Message = request.Message,
            IsCoachComment = request.IsCoachComment
        });
        database.CommentThreads.Add(thread);
    }

    private static T Deserialize<T>(string payloadJson) =>
        JsonSerializer.Deserialize<T>(payloadJson, JsonOptions)
        ?? throw new JsonException("Sync command payload is empty.");

    private static decimal ResolveOneRepMax(AthleteProfile athlete, ExerciseType exerciseType) => exerciseType switch
    {
        ExerciseType.Squat => athlete.SquatOneRepMaxKg,
        ExerciseType.BenchPress => athlete.BenchOneRepMaxKg,
        ExerciseType.Deadlift => athlete.DeadliftOneRepMaxKg,
        _ => decimal.MaxValue
    };
}
