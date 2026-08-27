using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
public partial class TrainingDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder
            .HasAnnotation("ProductVersion", "8.0.11")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.AthleteProfile", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<string>("ActiveBlockTag").HasMaxLength(80).HasColumnType("character varying(80)");
            builder.Property<decimal>("BenchOneRepMaxKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<decimal>("BodyWeightKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<string>("CompetitionWeightClass").IsRequired().HasMaxLength(32).HasColumnType("character varying(32)");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("CurrentWorkoutStreak").HasColumnType("integer");
            builder.Property<decimal>("CumulativeWorkingSetTonnageKg").HasPrecision(12, 2).HasColumnType("numeric(12,2)");
            builder.Property<decimal>("DeadliftOneRepMaxKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<string>("DisplayName").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            builder.Property<int>("ExperiencePoints").HasColumnType("integer");
            builder.Property<string>("ExternalUserId").IsRequired().HasMaxLength(128).HasColumnType("character varying(128)");
            builder.Property<DateOnly?>("LastCompletedTrainingDate").HasColumnType("date");
            builder.Property<Guid?>("PlatformUserId").HasColumnType("uuid");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<int>("Sex").HasColumnType("integer");
            builder.Property<decimal>("SquatOneRepMaxKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("UpcomingMeetIdentifier").HasMaxLength(128).HasColumnType("character varying(128)");
            builder.HasKey("Id");
            builder.HasIndex("ExternalUserId").IsUnique();
            builder.HasIndex("PlatformUserId").IsUnique();
            builder.ToTable("AthleteProfiles");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.PlatformUser", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<Guid?>("CoachId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("DisplayName").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            builder.Property<string>("Email").IsRequired().HasMaxLength(320).HasColumnType("character varying(320)");
            builder.Property<string>("NormalizedEmail").IsRequired().HasMaxLength(320).HasColumnType("character varying(320)");
            builder.Property<string>("PasswordHash").IsRequired().HasMaxLength(512).HasColumnType("character varying(512)");
            builder.Property<DateTimeOffset?>("PasswordResetExpiresAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("PasswordResetTokenHash").HasMaxLength(128).HasColumnType("character varying(128)");
            builder.Property<int>("Role").HasColumnType("integer");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<int>("SessionVersion").HasColumnType("integer");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("CoachId");
            builder.HasIndex("NormalizedEmail").IsUnique();
            builder.HasIndex("PasswordResetTokenHash").IsUnique();
            builder.ToTable("PlatformUsers");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.CoachInvitation", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<DateTimeOffset?>("AcceptedAt").HasColumnType("timestamp with time zone");
            builder.Property<Guid>("CoachId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<DateTimeOffset>("ExpiresAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("RecipientEmail").IsRequired().HasMaxLength(320).HasColumnType("character varying(320)");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<string>("TokenHash").IsRequired().HasMaxLength(128).HasColumnType("character varying(128)");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("CoachId", "RecipientEmail");
            builder.HasIndex("TokenHash").IsUnique();
            builder.ToTable("CoachInvitations");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplate", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<Guid>("CoachId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("Goal").IsRequired().HasMaxLength(1000).HasColumnType("character varying(1000)");
            builder.Property<string>("Name").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<string>("Phase").HasMaxLength(80).HasColumnType("character varying(80)");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<int>("TrainingDaysPerWeek").HasColumnType("integer");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("CoachId", "Name").IsUnique();
            builder.ToTable("ProgramTemplates");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateWeek", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("Name").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            builder.Property<Guid>("ProgramTemplateId").HasColumnType("uuid");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("WeekNumber").HasColumnType("integer");
            builder.HasKey("Id");
            builder.HasIndex("ProgramTemplateId", "WeekNumber").IsUnique();
            builder.ToTable("ProgramTemplateWeeks");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateDay", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("DayNumber").HasColumnType("integer");
            builder.Property<string>("Focus").IsRequired().HasMaxLength(300).HasColumnType("character varying(300)");
            builder.Property<string>("Name").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<Guid>("ProgramTemplateWeekId").HasColumnType("uuid");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("ProgramTemplateWeekId", "DayNumber").IsUnique();
            builder.ToTable("ProgramTemplateDays");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateExercise", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("ExerciseType").HasColumnType("integer");
            builder.Property<string>("Name").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<int>("PrescriptionMode").HasColumnType("integer");
            builder.Property<decimal>("PrescriptionValue").HasPrecision(7, 2).HasColumnType("numeric(7,2)");
            builder.Property<Guid>("ProgramTemplateDayId").HasColumnType("uuid");
            builder.Property<int>("Repetitions").HasColumnType("integer");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<int>("Sets").HasColumnType("integer");
            builder.Property<int>("SortOrder").HasColumnType("integer");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("WeightUnit").IsRequired().HasMaxLength(4).HasColumnType("character varying(4)");
            builder.HasKey("Id");
            builder.HasIndex("ProgramTemplateDayId", "SortOrder").IsUnique();
            builder.ToTable("ProgramTemplateExercises");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingBlock", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<Guid>("AthleteProfileId").HasColumnType("uuid");
            builder.Property<Guid?>("CoachId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<DateOnly>("EndsOn").HasColumnType("date");
            builder.Property<bool>("IsActive").HasColumnType("boolean");
            builder.Property<string>("Name").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<Guid?>("ProgramTemplateId").HasColumnType("uuid");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<DateOnly>("StartsOn").HasColumnType("date");
            builder.Property<string>("Tag").IsRequired().HasMaxLength(80).HasColumnType("character varying(80)");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("AthleteProfileId", "Tag").IsUnique();
            builder.HasIndex("CoachId");
            builder.HasIndex("ProgramTemplateId");
            builder.ToTable("TrainingBlocks");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingWeek", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<DateOnly>("StartsOn").HasColumnType("date");
            builder.Property<Guid>("TrainingBlockId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("WeekNumber").HasColumnType("integer");
            builder.HasKey("Id");
            builder.HasIndex("TrainingBlockId", "WeekNumber").IsUnique();
            builder.ToTable("TrainingWeeks");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingDay", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<DateTimeOffset?>("CompletedAt").HasColumnType("timestamp with time zone");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("Focus").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<string>("Name").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<int>("PrescriptionMode").HasColumnType("integer");
            builder.Property<decimal>("PrescriptionValue").HasPrecision(7, 2).HasColumnType("numeric(7,2)");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<DateOnly>("ScheduledFor").HasColumnType("date");
            builder.Property<DateTimeOffset?>("StartedAt").HasColumnType("timestamp with time zone");
            builder.Property<Guid>("TrainingWeekId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("WeightUnit").IsRequired().HasMaxLength(4).HasColumnType("character varying(4)");
            builder.HasKey("Id");
            builder.HasIndex("TrainingWeekId", "ScheduledFor").IsUnique();
            builder.ToTable("TrainingDays");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.PrescribedExercise", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("ExerciseType").HasColumnType("integer");
            builder.Property<decimal>("ExerciseTypeModifier").HasPrecision(5, 3).HasColumnType("numeric(5,3)");
            builder.Property<string>("Name").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<int>("SortOrder").HasColumnType("integer");
            builder.Property<decimal>("TargetEstimatedOneRepMaxKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<Guid>("TrainingDayId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("TrainingDayId", "SortOrder").IsUnique();
            builder.ToTable("PrescribedExercises");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingSet", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<decimal?>("ActualEffortPercentage").HasPrecision(4, 3).HasColumnType("numeric(4,3)");
            builder.Property<decimal?>("ActualEstimatedOneRepMaxKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<decimal?>("ActualLoadKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<decimal?>("ActualRpe").HasPrecision(3, 1).HasColumnType("numeric(3,1)");
            builder.Property<int?>("ActualRepetitions").HasColumnType("integer");
            builder.Property<string>("AthleteNote").HasMaxLength(2000).HasColumnType("character varying(2000)");
            builder.Property<string>("CoachFormFlags").HasMaxLength(2000).HasColumnType("character varying(2000)");
            builder.Property<DateTimeOffset?>("CompletedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("CompletionStatus").HasColumnType("integer");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("InstagramVideoUrl").HasMaxLength(2048).HasColumnType("character varying(2048)");
            builder.Property<int>("Intent").HasColumnType("integer");
            builder.Property<Guid>("PrescribedExerciseId").HasColumnType("uuid");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<int>("SetNumber").HasColumnType("integer");
            builder.Property<decimal>("TargetEstimatedOneRepMaxKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<decimal>("TargetLoadKg").HasPrecision(6, 2).HasColumnType("numeric(6,2)");
            builder.Property<decimal>("TargetRpe").HasPrecision(3, 1).HasColumnType("numeric(3,1)");
            builder.Property<int>("TargetRepetitions").HasColumnType("integer");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("PrescribedExerciseId", "SetNumber").IsUnique();
            builder.ToTable("TrainingSets");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.CommentThread", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<Guid>("AthleteProfileId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<int>("ContextType").HasColumnType("integer");
            builder.Property<bool>("IsResolved").HasColumnType("boolean");
            builder.Property<Guid?>("PrescribedExerciseId").HasColumnType("uuid");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<string>("Subject").IsRequired().HasMaxLength(200).HasColumnType("character varying(200)");
            builder.Property<Guid?>("TrainingDayId").HasColumnType("uuid");
            builder.Property<Guid?>("TrainingSetId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("AthleteProfileId");
            builder.HasIndex("PrescribedExerciseId");
            builder.HasIndex("TrainingDayId");
            builder.HasIndex("TrainingSetId");
            builder.ToTable("CommentThreads");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ThreadComment", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<string>("AuthorDisplayName").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            builder.Property<string>("AuthorUserId").IsRequired().HasMaxLength(128).HasColumnType("character varying(128)");
            builder.Property<Guid>("CommentThreadId").HasColumnType("uuid");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<bool>("IsCoachComment").HasColumnType("boolean");
            builder.Property<string>("Message").IsRequired().HasMaxLength(5000).HasColumnType("character varying(5000)");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("CommentThreadId");
            builder.ToTable("ThreadComments");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.SyncCommand", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<Guid>("AggregateId").HasColumnType("uuid");
            builder.Property<Guid>("AthleteProfileId").HasColumnType("uuid");
            builder.Property<Guid>("CommandId").HasColumnType("uuid");
            builder.Property<string>("CommandType").IsRequired().HasMaxLength(40).HasColumnType("character varying(40)");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("DeviceId").IsRequired().HasMaxLength(128).HasColumnType("character varying(128)");
            builder.Property<string>("PayloadJson").IsRequired().HasColumnType("jsonb");
            builder.Property<DateTimeOffset?>("ProcessedAt").HasColumnType("timestamp with time zone");
            builder.Property<string>("RejectionReason").HasMaxLength(1000).HasColumnType("character varying(1000)");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<int>("Status").HasColumnType("integer");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.HasKey("Id");
            builder.HasIndex("AthleteProfileId", "Status");
            builder.HasIndex("CommandId").IsUnique();
            builder.ToTable("SyncCommands");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.AthleteAchievement", builder =>
        {
            builder.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            builder.Property<Guid>("AthleteProfileId").HasColumnType("uuid");
            builder.Property<string>("BadgeCode").IsRequired().HasMaxLength(80).HasColumnType("character varying(80)");
            builder.Property<DateTimeOffset>("CreatedAt").HasColumnType("timestamp with time zone");
            builder.Property<DateTimeOffset>("EarnedAt").HasColumnType("timestamp with time zone");
            builder.Property<byte[]>("RowVersion").IsConcurrencyToken().HasColumnType("bytea");
            builder.Property<string>("Title").IsRequired().HasMaxLength(160).HasColumnType("character varying(160)");
            builder.Property<int>("Type").HasColumnType("integer");
            builder.Property<DateTimeOffset>("UpdatedAt").HasColumnType("timestamp with time zone");
            builder.Property<decimal?>("Value").HasPrecision(12, 2).HasColumnType("numeric(12,2)");
            builder.HasKey("Id");
            builder.HasIndex("AthleteProfileId", "BadgeCode").IsUnique();
            builder.ToTable("AthleteAchievements");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.AthleteProfile", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.PlatformUser", "PlatformUser")
                .WithOne("AthleteProfile")
                .HasForeignKey("PowerliftingProgram.Domain.Entities.AthleteProfile", "PlatformUserId")
                .OnDelete(DeleteBehavior.Cascade);
            builder.Navigation("PlatformUser");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.PlatformUser", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.PlatformUser", "Coach")
                .WithMany("Athletes")
                .HasForeignKey("CoachId")
                .OnDelete(DeleteBehavior.Restrict);
            builder.Navigation("Coach");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.CoachInvitation", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.PlatformUser", "Coach")
                .WithMany("SentInvitations")
                .HasForeignKey("CoachId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("Coach");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplate", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.PlatformUser", "Coach")
                .WithMany("ProgramTemplates")
                .HasForeignKey("CoachId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("Coach");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateWeek", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.ProgramTemplate", "ProgramTemplate")
                .WithMany("Weeks")
                .HasForeignKey("ProgramTemplateId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("ProgramTemplate");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateDay", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.ProgramTemplateWeek", "ProgramTemplateWeek")
                .WithMany("Days")
                .HasForeignKey("ProgramTemplateWeekId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("ProgramTemplateWeek");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateExercise", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.ProgramTemplateDay", "ProgramTemplateDay")
                .WithMany("Exercises")
                .HasForeignKey("ProgramTemplateDayId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("ProgramTemplateDay");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingBlock", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.AthleteProfile", "AthleteProfile")
                .WithMany("TrainingBlocks")
                .HasForeignKey("AthleteProfileId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.HasOne("PowerliftingProgram.Domain.Entities.PlatformUser", "Coach")
                .WithMany()
                .HasForeignKey("CoachId")
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne("PowerliftingProgram.Domain.Entities.ProgramTemplate", "ProgramTemplate")
                .WithMany()
                .HasForeignKey("ProgramTemplateId")
                .OnDelete(DeleteBehavior.SetNull);
            builder.Navigation("AthleteProfile");
            builder.Navigation("Coach");
            builder.Navigation("ProgramTemplate");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingWeek", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.TrainingBlock", "TrainingBlock")
                .WithMany("Weeks")
                .HasForeignKey("TrainingBlockId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("TrainingBlock");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingDay", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.TrainingWeek", "TrainingWeek")
                .WithMany("Days")
                .HasForeignKey("TrainingWeekId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("TrainingWeek");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.PrescribedExercise", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.TrainingDay", "TrainingDay")
                .WithMany("Exercises")
                .HasForeignKey("TrainingDayId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("TrainingDay");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingSet", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.PrescribedExercise", "PrescribedExercise")
                .WithMany("Sets")
                .HasForeignKey("PrescribedExerciseId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("PrescribedExercise");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.CommentThread", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.AthleteProfile", "AthleteProfile")
                .WithMany("CommentThreads")
                .HasForeignKey("AthleteProfileId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.HasOne("PowerliftingProgram.Domain.Entities.PrescribedExercise", "PrescribedExercise")
                .WithMany("CommentThreads")
                .HasForeignKey("PrescribedExerciseId")
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne("PowerliftingProgram.Domain.Entities.TrainingDay", "TrainingDay")
                .WithMany("CommentThreads")
                .HasForeignKey("TrainingDayId")
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne("PowerliftingProgram.Domain.Entities.TrainingSet", "TrainingSet")
                .WithMany("CommentThreads")
                .HasForeignKey("TrainingSetId")
                .OnDelete(DeleteBehavior.Restrict);
            builder.Navigation("AthleteProfile");
            builder.Navigation("PrescribedExercise");
            builder.Navigation("TrainingDay");
            builder.Navigation("TrainingSet");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ThreadComment", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.CommentThread", "CommentThread")
                .WithMany("Comments")
                .HasForeignKey("CommentThreadId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("CommentThread");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.SyncCommand", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.AthleteProfile", "AthleteProfile")
                .WithMany()
                .HasForeignKey("AthleteProfileId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("AthleteProfile");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.AthleteAchievement", builder =>
        {
            builder.HasOne("PowerliftingProgram.Domain.Entities.AthleteProfile", "AthleteProfile")
                .WithMany("Achievements")
                .HasForeignKey("AthleteProfileId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
            builder.Navigation("AthleteProfile");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.AthleteProfile", builder =>
        {
            builder.Navigation("Achievements");
            builder.Navigation("CommentThreads");
            builder.Navigation("TrainingBlocks");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.PlatformUser", builder =>
        {
            builder.Navigation("AthleteProfile");
            builder.Navigation("Athletes");
            builder.Navigation("ProgramTemplates");
            builder.Navigation("SentInvitations");
        });

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplate", builder => builder.Navigation("Weeks"));
        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateWeek", builder => builder.Navigation("Days"));
        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.ProgramTemplateDay", builder => builder.Navigation("Exercises"));

        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingBlock", builder => builder.Navigation("Weeks"));
        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingWeek", builder => builder.Navigation("Days"));
        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingDay", builder =>
        {
            builder.Navigation("CommentThreads");
            builder.Navigation("Exercises");
        });
        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.PrescribedExercise", builder =>
        {
            builder.Navigation("CommentThreads");
            builder.Navigation("Sets");
        });
        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.TrainingSet", builder => builder.Navigation("CommentThreads"));
        modelBuilder.Entity("PowerliftingProgram.Domain.Entities.CommentThread", builder => builder.Navigation("Comments"));
#pragma warning restore 612, 618
    }
}
