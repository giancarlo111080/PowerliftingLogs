namespace PowerliftingProgram.Domain.Entities;

public enum PerformanceEventKind
{
    RecoveryCheckIn = 0,
    TechniqueObservation = 1,
    Recommendation = 2,
    CoachDecision = 3,
    ProgramVersion = 4,
    CompetitionPlan = 5,
    CompetitionAttempt = 6,
    CompetitionResult = 7,
    ConsentGrant = 8,
    ModelPrediction = 9,
    VideoAnnotation = 10,
    AthleteGroup = 11,
    ExerciseLibraryItem = 12,
    ExceptionDisposition = 13
}

public sealed class PerformanceEvent : Entity
{
    public Guid TenantId { get; set; }
    public Guid AthleteProfileId { get; set; }
    public Guid? ActorUserId { get; set; }
    public PerformanceEventKind Kind { get; set; }
    public DateTimeOffset OccurredAtUtc { get; set; }
    public required string Source { get; set; }
    public int SchemaVersion { get; set; } = 1;
    public required string Provenance { get; set; }
    public required string PayloadJson { get; set; }
    public Guid? CorrelationId { get; set; }
    public string? StableKey { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
    public PlatformUser? ActorUser { get; set; }
}