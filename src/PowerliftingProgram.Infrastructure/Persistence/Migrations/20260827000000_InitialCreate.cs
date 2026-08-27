using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

#nullable disable

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260827000000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "AthleteProfiles",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ExternalUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                DisplayName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                Sex = table.Column<int>(type: "integer", nullable: false),
                BodyWeightKg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                CompetitionWeightClass = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                SquatOneRepMaxKg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                BenchOneRepMaxKg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                DeadliftOneRepMaxKg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                ActiveBlockTag = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                UpcomingMeetIdentifier = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                CumulativeWorkingSetTonnageKg = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                ExperiencePoints = table.Column<int>(type: "integer", nullable: false),
                CurrentWorkoutStreak = table.Column<int>(type: "integer", nullable: false),
                LastCompletedTrainingDate = table.Column<DateOnly>(type: "date", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_AthleteProfiles", item => item.Id));

        migrationBuilder.CreateTable(
            name: "TrainingBlocks",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                AthleteProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                Tag = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                EndsOn = table.Column<DateOnly>(type: "date", nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TrainingBlocks", item => item.Id);
                table.ForeignKey("FK_TrainingBlocks_AthleteProfiles_AthleteProfileId", item => item.AthleteProfileId, "AthleteProfiles", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "AthleteAchievements",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                AthleteProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                Type = table.Column<int>(type: "integer", nullable: false),
                BadgeCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                Title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                EarnedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Value = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AthleteAchievements", item => item.Id);
                table.ForeignKey("FK_AthleteAchievements_AthleteProfiles_AthleteProfileId", item => item.AthleteProfileId, "AthleteProfiles", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "SyncCommands",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CommandId = table.Column<Guid>(type: "uuid", nullable: false),
                AthleteProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                AggregateId = table.Column<Guid>(type: "uuid", nullable: false),
                CommandType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                DeviceId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                Status = table.Column<int>(type: "integer", nullable: false),
                ProcessedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SyncCommands", item => item.Id);
                table.ForeignKey("FK_SyncCommands_AthleteProfiles_AthleteProfileId", item => item.AthleteProfileId, "AthleteProfiles", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "TrainingWeeks",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TrainingBlockId = table.Column<Guid>(type: "uuid", nullable: false),
                WeekNumber = table.Column<int>(type: "integer", nullable: false),
                StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TrainingWeeks", item => item.Id);
                table.ForeignKey("FK_TrainingWeeks_TrainingBlocks_TrainingBlockId", item => item.TrainingBlockId, "TrainingBlocks", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "TrainingDays",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TrainingWeekId = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                Focus = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                ScheduledFor = table.Column<DateOnly>(type: "date", nullable: false),
                StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TrainingDays", item => item.Id);
                table.ForeignKey("FK_TrainingDays_TrainingWeeks_TrainingWeekId", item => item.TrainingWeekId, "TrainingWeeks", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "PrescribedExercises",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TrainingDayId = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                ExerciseType = table.Column<int>(type: "integer", nullable: false),
                ExerciseTypeModifier = table.Column<decimal>(type: "numeric(5,3)", nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
                TargetEstimatedOneRepMaxKg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PrescribedExercises", item => item.Id);
                table.ForeignKey("FK_PrescribedExercises_TrainingDays_TrainingDayId", item => item.TrainingDayId, "TrainingDays", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "TrainingSets",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                PrescribedExerciseId = table.Column<Guid>(type: "uuid", nullable: false),
                SetNumber = table.Column<int>(type: "integer", nullable: false),
                Intent = table.Column<int>(type: "integer", nullable: false),
                TargetRepetitions = table.Column<int>(type: "integer", nullable: false),
                TargetLoadKg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                TargetRpe = table.Column<decimal>(type: "numeric(3,1)", nullable: false),
                TargetEstimatedOneRepMaxKg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                CompletionStatus = table.Column<int>(type: "integer", nullable: false),
                ActualLoadKg = table.Column<decimal>(type: "numeric(6,2)", nullable: true),
                ActualRepetitions = table.Column<int>(type: "integer", nullable: true),
                ActualRpe = table.Column<decimal>(type: "numeric(3,1)", nullable: true),
                ActualEstimatedOneRepMaxKg = table.Column<decimal>(type: "numeric(6,2)", nullable: true),
                ActualEffortPercentage = table.Column<decimal>(type: "numeric(4,3)", nullable: true),
                CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                InstagramVideoUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                AthleteNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                CoachFormFlags = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TrainingSets", item => item.Id);
                table.ForeignKey("FK_TrainingSets_PrescribedExercises_PrescribedExerciseId", item => item.PrescribedExerciseId, "PrescribedExercises", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "CommentThreads",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                AthleteProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                TrainingDayId = table.Column<Guid>(type: "uuid", nullable: true),
                PrescribedExerciseId = table.Column<Guid>(type: "uuid", nullable: true),
                TrainingSetId = table.Column<Guid>(type: "uuid", nullable: true),
                ContextType = table.Column<int>(type: "integer", nullable: false),
                Subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                IsResolved = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CommentThreads", item => item.Id);
                table.ForeignKey("FK_CommentThreads_AthleteProfiles_AthleteProfileId", item => item.AthleteProfileId, "AthleteProfiles", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_CommentThreads_PrescribedExercises_PrescribedExerciseId", item => item.PrescribedExerciseId, "PrescribedExercises", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_CommentThreads_TrainingDays_TrainingDayId", item => item.TrainingDayId, "TrainingDays", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_CommentThreads_TrainingSets_TrainingSetId", item => item.TrainingSetId, "TrainingSets", "Id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "ThreadComments",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CommentThreadId = table.Column<Guid>(type: "uuid", nullable: false),
                AuthorUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                AuthorDisplayName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                Message = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                IsCoachComment = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ThreadComments", item => item.Id);
                table.ForeignKey("FK_ThreadComments_CommentThreads_CommentThreadId", item => item.CommentThreadId, "CommentThreads", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(name: "IX_AthleteProfiles_ExternalUserId", table: "AthleteProfiles", column: "ExternalUserId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_AthleteAchievements_AthleteProfileId_BadgeCode", table: "AthleteAchievements", columns: ["AthleteProfileId", "BadgeCode"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_SyncCommands_CommandId", table: "SyncCommands", column: "CommandId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_SyncCommands_AthleteProfileId_Status", table: "SyncCommands", columns: ["AthleteProfileId", "Status"]);
        migrationBuilder.CreateIndex(name: "IX_TrainingBlocks_AthleteProfileId_Tag", table: "TrainingBlocks", columns: ["AthleteProfileId", "Tag"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_TrainingWeeks_TrainingBlockId_WeekNumber", table: "TrainingWeeks", columns: ["TrainingBlockId", "WeekNumber"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_TrainingDays_TrainingWeekId_ScheduledFor", table: "TrainingDays", columns: ["TrainingWeekId", "ScheduledFor"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_PrescribedExercises_TrainingDayId_SortOrder", table: "PrescribedExercises", columns: ["TrainingDayId", "SortOrder"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_TrainingSets_PrescribedExerciseId_SetNumber", table: "TrainingSets", columns: ["PrescribedExerciseId", "SetNumber"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_CommentThreads_AthleteProfileId", table: "CommentThreads", column: "AthleteProfileId");
        migrationBuilder.CreateIndex(name: "IX_CommentThreads_TrainingDayId", table: "CommentThreads", column: "TrainingDayId");
        migrationBuilder.CreateIndex(name: "IX_CommentThreads_PrescribedExerciseId", table: "CommentThreads", column: "PrescribedExerciseId");
        migrationBuilder.CreateIndex(name: "IX_CommentThreads_TrainingSetId", table: "CommentThreads", column: "TrainingSetId");
        migrationBuilder.CreateIndex(name: "IX_ThreadComments_CommentThreadId", table: "ThreadComments", column: "CommentThreadId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "AthleteAchievements");
        migrationBuilder.DropTable(name: "SyncCommands");
        migrationBuilder.DropTable(name: "ThreadComments");
        migrationBuilder.DropTable(name: "CommentThreads");
        migrationBuilder.DropTable(name: "TrainingSets");
        migrationBuilder.DropTable(name: "PrescribedExercises");
        migrationBuilder.DropTable(name: "TrainingDays");
        migrationBuilder.DropTable(name: "TrainingWeeks");
        migrationBuilder.DropTable(name: "TrainingBlocks");
        migrationBuilder.DropTable(name: "AthleteProfiles");
    }
}
