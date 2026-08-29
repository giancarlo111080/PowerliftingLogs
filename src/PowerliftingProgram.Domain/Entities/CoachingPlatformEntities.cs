namespace PowerliftingProgram.Domain.Entities;

public enum PlatformRole
{
    Coach = 0,
    Athlete = 1
}

public enum CoachingRole
{
    Strength = 0,
    Nutrition = 1,
    Rehab = 2,
    Technique = 3,
    MeetDay = 4
}

public enum CoachingAccessLevel
{
    ReadOnly = 0,
    Comment = 1,
    Program = 2,
    Full = 3
}

public enum CoachingAssignmentStatus
{
    Pending = 0,
    Active = 1,
    Completed = 2,
    Revoked = 3,
    Declined = 4
}

public enum TemplatePrescriptionMode
{
    Rpe = 0,
    PercentageOfOneRepMax = 1,
    ExactLoad = 2
}

public enum ExerciseBodyPart
{
    Back = 0,
    Chest = 1,
    Shoulders = 2,
    Arms = 3,
    Legs = 4,
    Glutes = 5,
    Core = 6
}

public sealed class PlatformUser : Entity
{
    public required string Email { get; set; }
    public required string NormalizedEmail { get; set; }
    public required string DisplayName { get; set; }
    public required string PasswordHash { get; set; }
    public string? PasswordResetTokenHash { get; set; }
    public DateTimeOffset? PasswordResetExpiresAt { get; set; }
    public int SessionVersion { get; set; }
    public PlatformRole Role { get; set; }
    public bool CanCoach { get; set; }
    public Guid? CoachId { get; set; }

    public PlatformUser? Coach { get; set; }
    public ICollection<PlatformUser> Athletes { get; } = new List<PlatformUser>();
    public AthleteProfile? AthleteProfile { get; set; }
    public ICollection<CoachInvitation> SentInvitations { get; } = new List<CoachInvitation>();
    public ICollection<CoachingAssignment> CoachingAssignments { get; } = new List<CoachingAssignment>();
    public ICollection<CoachingAssignment> CoachAssignments { get; } = new List<CoachingAssignment>();
    public ICollection<ProgramTemplate> ProgramTemplates { get; } = new List<ProgramTemplate>();
    public ICollection<ExerciseLibraryItem> ExerciseLibraryItems { get; } = new List<ExerciseLibraryItem>();
}

public sealed class ExerciseLibraryItem : Entity
{
    public Guid? CoachId { get; set; }
    public required string Name { get; set; }
    public ExerciseBodyPart BodyPart { get; set; }
    public bool IsActive { get; set; } = true;

    public PlatformUser? Coach { get; set; }
}

public sealed class CoachingAssignment : Entity
{
    public Guid CoachId { get; set; }
    public Guid AthleteUserId { get; set; }
    public CoachingRole Role { get; set; } = CoachingRole.Strength;
    public CoachingAccessLevel AccessLevel { get; set; } = CoachingAccessLevel.Full;
    public CoachingAssignmentStatus Status { get; set; } = CoachingAssignmentStatus.Active;
    public bool IsPrimary { get; set; }
    public DateTimeOffset StartsAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndsAt { get; set; }
    public string? MovementScope { get; set; }

    public PlatformUser? Coach { get; set; }
    public PlatformUser? AthleteUser { get; set; }
}

public sealed class CoachInvitation : Entity
{
    public Guid CoachId { get; set; }
    public required string RecipientEmail { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public CoachingRole Role { get; set; } = CoachingRole.Strength;
    public CoachingAccessLevel AccessLevel { get; set; } = CoachingAccessLevel.Full;
    public bool IsPrimary { get; set; } = true;
    public DateTimeOffset? AssignmentEndsAt { get; set; }
    public string? MovementScope { get; set; }

    public PlatformUser? Coach { get; set; }
}

public sealed class ProgramTemplate : Entity
{
    public Guid CoachId { get; set; }
    public required string Name { get; set; }
    public required string Goal { get; set; }
    public string? Phase { get; set; }
    public int TrainingDaysPerWeek { get; set; }

    public PlatformUser? Coach { get; set; }
    public ICollection<ProgramTemplateWeek> Weeks { get; } = new List<ProgramTemplateWeek>();
}

public sealed class ProgramTemplateWeek : Entity
{
    public Guid ProgramTemplateId { get; set; }
    public int WeekNumber { get; set; }
    public required string Name { get; set; }

    public ProgramTemplate? ProgramTemplate { get; set; }
    public ICollection<ProgramTemplateDay> Days { get; } = new List<ProgramTemplateDay>();
}

public sealed class ProgramTemplateDay : Entity
{
    public Guid ProgramTemplateWeekId { get; set; }
    public int DayNumber { get; set; }
    public required string Name { get; set; }
    public required string Focus { get; set; }

    public ProgramTemplateWeek? ProgramTemplateWeek { get; set; }
    public ICollection<ProgramTemplateExercise> Exercises { get; } = new List<ProgramTemplateExercise>();
}

public sealed class ProgramTemplateExercise : Entity
{
    public Guid ProgramTemplateDayId { get; set; }
    public int SortOrder { get; set; }
    public required string Name { get; set; }
    public ExerciseType ExerciseType { get; set; }
    public int Sets { get; set; }
    public int Repetitions { get; set; }
    public TemplatePrescriptionMode PrescriptionMode { get; set; }
    public decimal PrescriptionValue { get; set; }
    public string WeightUnit { get; set; } = "kg";

    public ProgramTemplateDay? ProgramTemplateDay { get; set; }
}