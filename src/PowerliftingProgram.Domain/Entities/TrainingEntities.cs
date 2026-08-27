using System.ComponentModel.DataAnnotations;

namespace PowerliftingProgram.Domain.Entities;

public abstract class Entity
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public enum AthleteSex
{
    Female = 0,
    Male = 1,
    NonBinary = 2,
    PreferNotToSay = 3
}

public enum ExerciseType
{
    Squat = 0,
    BenchPress = 1,
    Deadlift = 2,
    OverheadPress = 3,
    Accessory = 4,
    Conditioning = 5
}

public enum SetIntent
{
    WarmUp = 0,
    Working = 1,
    BackOff = 2,
    Accessory = 3
}

public enum SetCompletionStatus
{
    Pending = 0,
    Done = 1,
    Skipped = 2
}

public enum SyncCommandStatus
{
    Pending = 0,
    Processed = 1,
    Rejected = 2
}

public enum CommentContextType
{
    TrainingDay = 0,
    Exercise = 1,
    Set = 2
}

public enum AchievementType
{
    PersonalRecord = 0,
    ConsistencyStreak = 1,
    VolumeMilestone = 2,
    MeetPreparation = 3
}

public sealed class AthleteProfile : Entity
{
    public required string ExternalUserId { get; set; }
    public required string DisplayName { get; set; }
    public AthleteSex Sex { get; set; }
    public decimal BodyWeightKg { get; set; }
    public required string CompetitionWeightClass { get; set; }
    public decimal SquatOneRepMaxKg { get; set; }
    public decimal BenchOneRepMaxKg { get; set; }
    public decimal DeadliftOneRepMaxKg { get; set; }
    public string? ActiveBlockTag { get; set; }
    public string? UpcomingMeetIdentifier { get; set; }
    public decimal CumulativeWorkingSetTonnageKg { get; set; }
    public int ExperiencePoints { get; set; }
    public int CurrentWorkoutStreak { get; set; }
    public DateOnly? LastCompletedTrainingDate { get; set; }

    public ICollection<TrainingBlock> TrainingBlocks { get; } = new List<TrainingBlock>();
    public ICollection<CommentThread> CommentThreads { get; } = new List<CommentThread>();
    public ICollection<AthleteAchievement> Achievements { get; } = new List<AthleteAchievement>();
}

public sealed class TrainingBlock : Entity
{
    public Guid AthleteProfileId { get; set; }
    public required string Tag { get; set; }
    public required string Name { get; set; }
    public DateOnly StartsOn { get; set; }
    public DateOnly EndsOn { get; set; }
    public bool IsActive { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
    public ICollection<TrainingWeek> Weeks { get; } = new List<TrainingWeek>();
}

public sealed class TrainingWeek : Entity
{
    public Guid TrainingBlockId { get; set; }
    public int WeekNumber { get; set; }
    public DateOnly StartsOn { get; set; }

    public TrainingBlock? TrainingBlock { get; set; }
    public ICollection<TrainingDay> Days { get; } = new List<TrainingDay>();
}

public sealed class TrainingDay : Entity
{
    public Guid TrainingWeekId { get; set; }
    public required string Name { get; set; }
    public required string Focus { get; set; }
    public DateOnly ScheduledFor { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public TrainingWeek? TrainingWeek { get; set; }
    public ICollection<PrescribedExercise> Exercises { get; } = new List<PrescribedExercise>();
    public ICollection<CommentThread> CommentThreads { get; } = new List<CommentThread>();
}

public sealed class PrescribedExercise : Entity
{
    public Guid TrainingDayId { get; set; }
    public required string Name { get; set; }
    public ExerciseType ExerciseType { get; set; }
    public decimal ExerciseTypeModifier { get; set; } = 1m;
    public int SortOrder { get; set; }
    public decimal TargetEstimatedOneRepMaxKg { get; set; }

    public TrainingDay? TrainingDay { get; set; }
    public ICollection<TrainingSet> Sets { get; } = new List<TrainingSet>();
    public ICollection<CommentThread> CommentThreads { get; } = new List<CommentThread>();
}

public sealed class TrainingSet : Entity
{
    public Guid PrescribedExerciseId { get; set; }
    public int SetNumber { get; set; }
    public SetIntent Intent { get; set; }
    public int TargetRepetitions { get; set; }
    public decimal TargetLoadKg { get; set; }
    public decimal TargetRpe { get; set; }
    public decimal TargetEstimatedOneRepMaxKg { get; set; }
    public SetCompletionStatus CompletionStatus { get; set; }
    public decimal? ActualLoadKg { get; set; }
    public int? ActualRepetitions { get; set; }
    public decimal? ActualRpe { get; set; }
    public decimal? ActualEstimatedOneRepMaxKg { get; set; }
    public decimal? ActualEffortPercentage { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? InstagramVideoUrl { get; set; }
    public string? AthleteNote { get; set; }
    public string? CoachFormFlags { get; set; }

    public PrescribedExercise? PrescribedExercise { get; set; }
    public ICollection<CommentThread> CommentThreads { get; } = new List<CommentThread>();
}

public sealed class CommentThread : Entity
{
    public Guid AthleteProfileId { get; set; }
    public Guid? TrainingDayId { get; set; }
    public Guid? PrescribedExerciseId { get; set; }
    public Guid? TrainingSetId { get; set; }
    public CommentContextType ContextType { get; set; }
    public required string Subject { get; set; }
    public bool IsResolved { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
    public TrainingDay? TrainingDay { get; set; }
    public PrescribedExercise? PrescribedExercise { get; set; }
    public TrainingSet? TrainingSet { get; set; }
    public ICollection<ThreadComment> Comments { get; } = new List<ThreadComment>();
}

public sealed class ThreadComment : Entity
{
    public Guid CommentThreadId { get; set; }
    public required string AuthorUserId { get; set; }
    public required string AuthorDisplayName { get; set; }
    public required string Message { get; set; }
    public bool IsCoachComment { get; set; }

    public CommentThread? CommentThread { get; set; }
}

public sealed class SyncCommand : Entity
{
    public Guid CommandId { get; set; }
    public Guid AthleteProfileId { get; set; }
    public Guid AggregateId { get; set; }
    public required string CommandType { get; set; }
    public required string PayloadJson { get; set; }
    public required string DeviceId { get; set; }
    public SyncCommandStatus Status { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public string? RejectionReason { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
}

public sealed class AthleteAchievement : Entity
{
    public Guid AthleteProfileId { get; set; }
    public AchievementType Type { get; set; }
    public required string BadgeCode { get; set; }
    public required string Title { get; set; }
    public DateTimeOffset EarnedAt { get; set; }
    public decimal? Value { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
}