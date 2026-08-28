using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Application.Contracts;

public sealed record LoggedSetRequest(
    Guid IdempotencyKey,
    Guid AthleteProfileId,
    Guid TrainingSetId,
    SetCompletionStatus CompletionStatus,
    decimal? ActualLoadKg,
    int? ActualRepetitions,
    decimal? ActualRpe,
    decimal? ActualEstimatedOneRepMaxKg,
    decimal? ActualEffortPercentage,
    string? InstagramVideoUrl,
    string? AthleteNote,
    decimal? MeanVelocityMps = null,
    int? RestSeconds = null,
    SetOutcomeReason? OutcomeReason = null);

public sealed record SyncCommandRequest(
    Guid CommandId,
    Guid AthleteProfileId,
    Guid AggregateId,
    string CommandType,
    string PayloadJson,
    string DeviceId,
    DateTimeOffset CreatedAt);

public sealed record InstagramVideoLinkRequest(
    Guid TrainingSetId,
    string InstagramVideoUrl,
    string? AthleteNote,
    string? CoachFormFlags);

public sealed record CommentRequest(
    Guid AthleteProfileId,
    Guid? TrainingDayId,
    Guid? PrescribedExerciseId,
    Guid? TrainingSetId,
    CommentContextType ContextType,
    string Subject,
    string Message,
    string AuthorUserId,
    string AuthorDisplayName,
    bool IsCoachComment);

public sealed record LoadObservation(
    DateOnly Date,
    int Repetitions,
    decimal PercentOfOneRepMax,
    decimal EffortPercentage,
    decimal ExerciseTypeModifier);

public sealed record LoadModelState(decimal AcuteLoad, decimal ChronicLoad);

public sealed record AthleteReadiness(
    DateOnly Date,
    decimal AcuteLoad,
    decimal ChronicLoad,
    int ReadinessScore,
    decimal AcuteToChronicRatio);

public sealed record SessionStressAnalytics(
    Guid TrainingDayId,
    decimal PlannedTonnageKg,
    decimal CompletedTonnageKg,
    decimal PlannedStress,
    decimal CompletedStress,
    decimal CompletionRate);