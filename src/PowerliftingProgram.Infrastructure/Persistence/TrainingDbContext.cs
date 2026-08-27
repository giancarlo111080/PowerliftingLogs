using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Infrastructure.Persistence;

public sealed class TrainingDbContext(DbContextOptions<TrainingDbContext> options) : DbContext(options)
{
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
