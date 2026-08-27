using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Infrastructure.Persistence;

public sealed class TrainingDbContext(DbContextOptions<TrainingDbContext> options) : DbContext(options)
{
    public DbSet<PlatformUser> PlatformUsers => Set<PlatformUser>();
    public DbSet<CoachInvitation> CoachInvitations => Set<CoachInvitation>();
    public DbSet<ProgramTemplate> ProgramTemplates => Set<ProgramTemplate>();
    public DbSet<ProgramTemplateWeek> ProgramTemplateWeeks => Set<ProgramTemplateWeek>();
    public DbSet<ProgramTemplateDay> ProgramTemplateDays => Set<ProgramTemplateDay>();
    public DbSet<ProgramTemplateExercise> ProgramTemplateExercises => Set<ProgramTemplateExercise>();
    public DbSet<AthleteProfile> AthleteProfiles => Set<AthleteProfile>();
    public DbSet<TrainingBlock> TrainingBlocks => Set<TrainingBlock>();
    public DbSet<TrainingWeek> TrainingWeeks => Set<TrainingWeek>();
    public DbSet<TrainingDay> TrainingDays => Set<TrainingDay>();
    public DbSet<PrescribedExercise> PrescribedExercises => Set<PrescribedExercise>();
    public DbSet<TrainingSet> TrainingSets => Set<TrainingSet>();
    public DbSet<CommentThread> CommentThreads => Set<CommentThread>();
    public DbSet<ThreadComment> ThreadComments => Set<ThreadComment>();
    public DbSet<SyncCommand> SyncCommands => Set<SyncCommand>();
    public DbSet<AthleteAchievement> AthleteAchievements => Set<AthleteAchievement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TrainingDbContext).Assembly);
    }
}
