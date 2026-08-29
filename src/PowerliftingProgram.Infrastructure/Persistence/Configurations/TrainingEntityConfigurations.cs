using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Infrastructure.Persistence.Configurations;

internal static class EntityConfigurationExtensions
{
    public static void ConfigureEntity<TEntity>(this EntityTypeBuilder<TEntity> builder)
        where TEntity : Entity
    {
        builder.HasKey(entity => entity.Id);
        builder.Property(entity => entity.CreatedAt).IsRequired();
        builder.Property(entity => entity.UpdatedAt).IsRequired();
        builder.Property(entity => entity.RowVersion)
            .IsConcurrencyToken()
            .ValueGeneratedNever()
            .IsRequired(false)
            .HasColumnType("bytea");
    }
}

public sealed class AthleteProfileConfiguration : IEntityTypeConfiguration<AthleteProfile>
{
    public void Configure(EntityTypeBuilder<AthleteProfile> builder)
    {
        builder.ConfigureEntity();
        builder.Property(profile => profile.ExternalUserId).HasMaxLength(128).IsRequired();
        builder.Property(profile => profile.DisplayName).HasMaxLength(120).IsRequired();
        builder.Property(profile => profile.CountryCode).HasMaxLength(2);
        builder.Property(profile => profile.CompetitionWeightClass).HasMaxLength(32).IsRequired();
        builder.Property(profile => profile.ActiveBlockTag).HasMaxLength(80);
        builder.Property(profile => profile.UpcomingMeetIdentifier).HasMaxLength(128);
        builder.Property(profile => profile.BodyWeightKg).HasPrecision(6, 2);
        builder.Property(profile => profile.SquatOneRepMaxKg).HasPrecision(6, 2);
        builder.Property(profile => profile.BenchOneRepMaxKg).HasPrecision(6, 2);
        builder.Property(profile => profile.DeadliftOneRepMaxKg).HasPrecision(6, 2);
        builder.Property(profile => profile.CumulativeWorkingSetTonnageKg).HasPrecision(12, 2);
        builder.HasIndex(profile => profile.ExternalUserId).IsUnique();
        builder.HasIndex(profile => profile.PlatformUserId).IsUnique();
        builder.HasOne(profile => profile.PlatformUser).WithOne(user => user.AthleteProfile)
            .HasForeignKey<AthleteProfile>(profile => profile.PlatformUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PlatformUserConfiguration : IEntityTypeConfiguration<PlatformUser>
{
    public void Configure(EntityTypeBuilder<PlatformUser> builder)
    {
        builder.ConfigureEntity();
        builder.Property(user => user.Email).HasMaxLength(320).IsRequired();
        builder.Property(user => user.NormalizedEmail).HasMaxLength(320).IsRequired();
        builder.Property(user => user.DisplayName).HasMaxLength(120).IsRequired();
        builder.Property(user => user.PasswordHash).HasMaxLength(512).IsRequired();
        builder.Property(user => user.PasswordResetTokenHash).HasMaxLength(128);
        builder.Property(user => user.CanCoach).HasDefaultValue(false);
        builder.HasIndex(user => user.NormalizedEmail).IsUnique();
        builder.HasIndex(user => user.PasswordResetTokenHash).IsUnique();
        builder.HasOne(user => user.Coach).WithMany(coach => coach.Athletes)
            .HasForeignKey(user => user.CoachId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CoachingAssignmentConfiguration : IEntityTypeConfiguration<CoachingAssignment>
{
    public void Configure(EntityTypeBuilder<CoachingAssignment> builder)
    {
        builder.ConfigureEntity();
        builder.Property(assignment => assignment.MovementScope).HasMaxLength(500);
        builder.HasIndex(assignment => new { assignment.AthleteUserId, assignment.Status });
        builder.HasIndex(assignment => new { assignment.CoachId, assignment.Status });
        builder.HasIndex(assignment => new { assignment.CoachId, assignment.AthleteUserId, assignment.Role, assignment.Status });
        builder.HasOne(assignment => assignment.Coach).WithMany(coach => coach.CoachAssignments)
            .HasForeignKey(assignment => assignment.CoachId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(assignment => assignment.AthleteUser).WithMany(athlete => athlete.CoachingAssignments)
            .HasForeignKey(assignment => assignment.AthleteUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PerformanceEventConfiguration : IEntityTypeConfiguration<PerformanceEvent>
{
    public void Configure(EntityTypeBuilder<PerformanceEvent> builder)
    {
        builder.ConfigureEntity();
        builder.Property(performanceEvent => performanceEvent.Source).HasMaxLength(80).IsRequired();
        builder.Property(performanceEvent => performanceEvent.Provenance).HasMaxLength(500).IsRequired();
        builder.Property(performanceEvent => performanceEvent.PayloadJson).HasColumnType("jsonb").IsRequired();
        builder.Property(performanceEvent => performanceEvent.StableKey).HasMaxLength(160);
        builder.HasIndex(performanceEvent => new { performanceEvent.TenantId, performanceEvent.AthleteProfileId, performanceEvent.Kind, performanceEvent.OccurredAtUtc });
        builder.HasIndex(performanceEvent => new { performanceEvent.TenantId, performanceEvent.StableKey }).IsUnique();
        builder.HasIndex(performanceEvent => performanceEvent.CorrelationId);
        builder.HasOne(performanceEvent => performanceEvent.AthleteProfile).WithMany()
            .HasForeignKey(performanceEvent => performanceEvent.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(performanceEvent => performanceEvent.ActorUser).WithMany()
            .HasForeignKey(performanceEvent => performanceEvent.ActorUserId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class CoachInvitationConfiguration : IEntityTypeConfiguration<CoachInvitation>
{
    public void Configure(EntityTypeBuilder<CoachInvitation> builder)
    {
        builder.ConfigureEntity();
        builder.Property(invitation => invitation.RecipientEmail).HasMaxLength(320).IsRequired();
        builder.Property(invitation => invitation.TokenHash).HasMaxLength(128).IsRequired();
        builder.Property(invitation => invitation.MovementScope).HasMaxLength(500);
        builder.HasIndex(invitation => invitation.TokenHash).IsUnique();
        builder.HasIndex(invitation => new { invitation.CoachId, invitation.RecipientEmail });
        builder.HasOne(invitation => invitation.Coach).WithMany(coach => coach.SentInvitations)
            .HasForeignKey(invitation => invitation.CoachId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProgramTemplateConfiguration : IEntityTypeConfiguration<ProgramTemplate>
{
    public void Configure(EntityTypeBuilder<ProgramTemplate> builder)
    {
        builder.ConfigureEntity();
        builder.Property(template => template.Name).HasMaxLength(160).IsRequired();
        builder.Property(template => template.Goal).HasMaxLength(1_000).IsRequired();
        builder.Property(template => template.Phase).HasMaxLength(80);
        builder.HasIndex(template => new { template.CoachId, template.Name }).IsUnique();
        builder.HasOne(template => template.Coach).WithMany(coach => coach.ProgramTemplates)
            .HasForeignKey(template => template.CoachId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProgramTemplateWeekConfiguration : IEntityTypeConfiguration<ProgramTemplateWeek>
{
    public void Configure(EntityTypeBuilder<ProgramTemplateWeek> builder)
    {
        builder.ConfigureEntity();
        builder.Property(week => week.Name).HasMaxLength(120).IsRequired();
        builder.HasIndex(week => new { week.ProgramTemplateId, week.WeekNumber }).IsUnique();
        builder.HasOne(week => week.ProgramTemplate).WithMany(template => template.Weeks)
            .HasForeignKey(week => week.ProgramTemplateId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProgramTemplateDayConfiguration : IEntityTypeConfiguration<ProgramTemplateDay>
{
    public void Configure(EntityTypeBuilder<ProgramTemplateDay> builder)
    {
        builder.ConfigureEntity();
        builder.Property(day => day.Name).HasMaxLength(160).IsRequired();
        builder.Property(day => day.Focus).HasMaxLength(300).IsRequired();
        builder.HasIndex(day => new { day.ProgramTemplateWeekId, day.DayNumber }).IsUnique();
        builder.HasOne(day => day.ProgramTemplateWeek).WithMany(week => week.Days)
            .HasForeignKey(day => day.ProgramTemplateWeekId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProgramTemplateExerciseConfiguration : IEntityTypeConfiguration<ProgramTemplateExercise>
{
    public void Configure(EntityTypeBuilder<ProgramTemplateExercise> builder)
    {
        builder.ConfigureEntity();
        builder.Property(exercise => exercise.Name).HasMaxLength(160).IsRequired();
        builder.Property(exercise => exercise.PrescriptionValue).HasPrecision(7, 2);
        builder.Property(exercise => exercise.WeightUnit).HasMaxLength(4).IsRequired();
        builder.HasIndex(exercise => new { exercise.ProgramTemplateDayId, exercise.SortOrder }).IsUnique();
        builder.HasOne(exercise => exercise.ProgramTemplateDay).WithMany(day => day.Exercises)
            .HasForeignKey(exercise => exercise.ProgramTemplateDayId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ExerciseLibraryItemConfiguration : IEntityTypeConfiguration<ExerciseLibraryItem>
{
    public void Configure(EntityTypeBuilder<ExerciseLibraryItem> builder)
    {
        builder.ConfigureEntity();
        builder.Property(item => item.Name).HasMaxLength(160).IsRequired();
        builder.HasIndex(item => new { item.BodyPart, item.Name });
        builder.HasIndex(item => new { item.CoachId, item.Name }).IsUnique();
        builder.HasOne(item => item.Coach).WithMany(coach => coach.ExerciseLibraryItems)
            .HasForeignKey(item => item.CoachId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TrainingBlockConfiguration : IEntityTypeConfiguration<TrainingBlock>
{
    public void Configure(EntityTypeBuilder<TrainingBlock> builder)
    {
        builder.ConfigureEntity();
        builder.Property(block => block.Tag).HasMaxLength(80).IsRequired();
        builder.Property(block => block.Name).HasMaxLength(160).IsRequired();
        builder.HasIndex(block => new { block.AthleteProfileId, block.Tag }).IsUnique();
        builder.HasOne(block => block.AthleteProfile).WithMany(profile => profile.TrainingBlocks)
            .HasForeignKey(block => block.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(block => block.Coach).WithMany().HasForeignKey(block => block.CoachId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(block => block.ProgramTemplate).WithMany().HasForeignKey(block => block.ProgramTemplateId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class TrainingWeekConfiguration : IEntityTypeConfiguration<TrainingWeek>
{
    public void Configure(EntityTypeBuilder<TrainingWeek> builder)
    {
        builder.ConfigureEntity();
        builder.HasIndex(week => new { week.TrainingBlockId, week.WeekNumber }).IsUnique();
        builder.HasOne(week => week.TrainingBlock).WithMany(block => block.Weeks)
            .HasForeignKey(week => week.TrainingBlockId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TrainingDayConfiguration : IEntityTypeConfiguration<TrainingDay>
{
    public void Configure(EntityTypeBuilder<TrainingDay> builder)
    {
        builder.ConfigureEntity();
        builder.Property(day => day.Name).HasMaxLength(160).IsRequired();
        builder.Property(day => day.Focus).HasMaxLength(160).IsRequired();
        builder.HasIndex(day => new { day.TrainingWeekId, day.ScheduledFor }).IsUnique();
        builder.HasOne(day => day.TrainingWeek).WithMany(week => week.Days)
            .HasForeignKey(day => day.TrainingWeekId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PrescribedExerciseConfiguration : IEntityTypeConfiguration<PrescribedExercise>
{
    public void Configure(EntityTypeBuilder<PrescribedExercise> builder)
    {
        builder.ConfigureEntity();
        builder.Property(exercise => exercise.Name).HasMaxLength(160).IsRequired();
        builder.Property(exercise => exercise.ExerciseTypeModifier).HasPrecision(5, 3);
        builder.Property(exercise => exercise.PrescriptionValue).HasPrecision(7, 2);
        builder.Property(exercise => exercise.WeightUnit).HasMaxLength(4).IsRequired();
        builder.Property(exercise => exercise.TargetEstimatedOneRepMaxKg).HasPrecision(6, 2);
        builder.HasIndex(exercise => new { exercise.TrainingDayId, exercise.SortOrder }).IsUnique();
        builder.HasOne(exercise => exercise.TrainingDay).WithMany(day => day.Exercises)
            .HasForeignKey(exercise => exercise.TrainingDayId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TrainingSetConfiguration : IEntityTypeConfiguration<TrainingSet>
{
    public void Configure(EntityTypeBuilder<TrainingSet> builder)
    {
        builder.ConfigureEntity();
        builder.Property(set => set.TargetLoadKg).HasPrecision(6, 2);
        builder.Property(set => set.TargetRpe).HasPrecision(3, 1);
        builder.Property(set => set.TargetEstimatedOneRepMaxKg).HasPrecision(6, 2);
        builder.Property(set => set.ActualLoadKg).HasPrecision(6, 2);
        builder.Property(set => set.ActualRpe).HasPrecision(3, 1);
        builder.Property(set => set.ActualEstimatedOneRepMaxKg).HasPrecision(6, 2);
        builder.Property(set => set.ActualEffortPercentage).HasPrecision(4, 3);
        builder.Property(set => set.MeanVelocityMps).HasPrecision(4, 3);
        builder.Property(set => set.InstagramVideoUrl).HasMaxLength(2_048);
        builder.Property(set => set.AthleteNote).HasMaxLength(2_000);
        builder.Property(set => set.CoachFormFlags).HasMaxLength(2_000);
        builder.HasIndex(set => new { set.PrescribedExerciseId, set.SetNumber }).IsUnique();
        builder.HasOne(set => set.PrescribedExercise).WithMany(exercise => exercise.Sets)
            .HasForeignKey(set => set.PrescribedExerciseId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CommentThreadConfiguration : IEntityTypeConfiguration<CommentThread>
{
    public void Configure(EntityTypeBuilder<CommentThread> builder)
    {
        builder.ConfigureEntity();
        builder.Property(thread => thread.Subject).HasMaxLength(200).IsRequired();
        builder.HasOne(thread => thread.AthleteProfile).WithMany(profile => profile.CommentThreads)
            .HasForeignKey(thread => thread.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(thread => thread.TrainingDay).WithMany(day => day.CommentThreads)
            .HasForeignKey(thread => thread.TrainingDayId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(thread => thread.PrescribedExercise).WithMany(exercise => exercise.CommentThreads)
            .HasForeignKey(thread => thread.PrescribedExerciseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(thread => thread.TrainingSet).WithMany(set => set.CommentThreads)
            .HasForeignKey(thread => thread.TrainingSetId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ThreadCommentConfiguration : IEntityTypeConfiguration<ThreadComment>
{
    public void Configure(EntityTypeBuilder<ThreadComment> builder)
    {
        builder.ConfigureEntity();
        builder.Property(comment => comment.AuthorUserId).HasMaxLength(128).IsRequired();
        builder.Property(comment => comment.AuthorDisplayName).HasMaxLength(120).IsRequired();
        builder.Property(comment => comment.Message).HasMaxLength(5_000).IsRequired();
        builder.HasOne(comment => comment.CommentThread).WithMany(thread => thread.Comments)
            .HasForeignKey(comment => comment.CommentThreadId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SyncCommandConfiguration : IEntityTypeConfiguration<SyncCommand>
{
    public void Configure(EntityTypeBuilder<SyncCommand> builder)
    {
        builder.ConfigureEntity();
        builder.Property(command => command.CommandType).HasMaxLength(40).IsRequired();
        builder.Property(command => command.PayloadJson).HasColumnType("jsonb").IsRequired();
        builder.Property(command => command.DeviceId).HasMaxLength(128).IsRequired();
        builder.Property(command => command.RejectionReason).HasMaxLength(1_000);
        builder.HasIndex(command => command.CommandId).IsUnique();
        builder.HasIndex(command => new { command.AthleteProfileId, command.Status });
        builder.HasOne(command => command.AthleteProfile).WithMany().HasForeignKey(command => command.AthleteProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class AthleteAchievementConfiguration : IEntityTypeConfiguration<AthleteAchievement>
{
    public void Configure(EntityTypeBuilder<AthleteAchievement> builder)
    {
        builder.ConfigureEntity();
        builder.Property(achievement => achievement.BadgeCode).HasMaxLength(80).IsRequired();
        builder.Property(achievement => achievement.Title).HasMaxLength(160).IsRequired();
        builder.Property(achievement => achievement.Value).HasPrecision(12, 2);
        builder.HasIndex(achievement => new { achievement.AthleteProfileId, achievement.BadgeCode }).IsUnique();
        builder.HasOne(achievement => achievement.AthleteProfile).WithMany(profile => profile.Achievements)
            .HasForeignKey(achievement => achievement.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
    }
}
