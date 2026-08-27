using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

#nullable disable

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260828000000_AddCoachingPlatform")]
public partial class AddCoachingPlatform : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "PlatformUsers",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                NormalizedEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                DisplayName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                Role = table.Column<int>(type: "integer", nullable: false),
                CoachId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PlatformUsers", item => item.Id);
                table.ForeignKey("FK_PlatformUsers_PlatformUsers_CoachId", item => item.CoachId, "PlatformUsers", "Id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "CoachInvitations",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CoachId = table.Column<Guid>(type: "uuid", nullable: false),
                RecipientEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                AcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CoachInvitations", item => item.Id);
                table.ForeignKey("FK_CoachInvitations_PlatformUsers_CoachId", item => item.CoachId, "PlatformUsers", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ProgramTemplates",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CoachId = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                Goal = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                Phase = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                TrainingDaysPerWeek = table.Column<int>(type: "integer", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProgramTemplates", item => item.Id);
                table.ForeignKey("FK_ProgramTemplates_PlatformUsers_CoachId", item => item.CoachId, "PlatformUsers", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ProgramTemplateWeeks",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ProgramTemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                WeekNumber = table.Column<int>(type: "integer", nullable: false),
                Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProgramTemplateWeeks", item => item.Id);
                table.ForeignKey("FK_ProgramTemplateWeeks_ProgramTemplates_ProgramTemplateId", item => item.ProgramTemplateId, "ProgramTemplates", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ProgramTemplateDays",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ProgramTemplateWeekId = table.Column<Guid>(type: "uuid", nullable: false),
                DayNumber = table.Column<int>(type: "integer", nullable: false),
                Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                Focus = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProgramTemplateDays", item => item.Id);
                table.ForeignKey("FK_ProgramTemplateDays_ProgramTemplateWeeks_ProgramTemplateWeekId", item => item.ProgramTemplateWeekId, "ProgramTemplateWeeks", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ProgramTemplateExercises",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ProgramTemplateDayId = table.Column<Guid>(type: "uuid", nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
                Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                ExerciseType = table.Column<int>(type: "integer", nullable: false),
                Sets = table.Column<int>(type: "integer", nullable: false),
                Repetitions = table.Column<int>(type: "integer", nullable: false),
                PrescriptionMode = table.Column<int>(type: "integer", nullable: false),
                PrescriptionValue = table.Column<decimal>(type: "numeric(7,2)", nullable: false),
                WeightUnit = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProgramTemplateExercises", item => item.Id);
                table.ForeignKey("FK_ProgramTemplateExercises_ProgramTemplateDays_ProgramTemplateDayId", item => item.ProgramTemplateDayId, "ProgramTemplateDays", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.AddColumn<Guid>(name: "PlatformUserId", table: "AthleteProfiles", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<Guid>(name: "CoachId", table: "TrainingBlocks", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<Guid>(name: "ProgramTemplateId", table: "TrainingBlocks", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<int>(name: "PrescriptionMode", table: "PrescribedExercises", type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<decimal>(name: "PrescriptionValue", table: "PrescribedExercises", type: "numeric(7,2)", nullable: false, defaultValue: 0m);
        migrationBuilder.AddColumn<string>(name: "WeightUnit", table: "PrescribedExercises", type: "character varying(4)", maxLength: 4, nullable: false, defaultValue: "kg");

        migrationBuilder.CreateIndex(name: "IX_PlatformUsers_NormalizedEmail", table: "PlatformUsers", column: "NormalizedEmail", unique: true);
        migrationBuilder.CreateIndex(name: "IX_PlatformUsers_CoachId", table: "PlatformUsers", column: "CoachId");
        migrationBuilder.CreateIndex(name: "IX_CoachInvitations_TokenHash", table: "CoachInvitations", column: "TokenHash", unique: true);
        migrationBuilder.CreateIndex(name: "IX_CoachInvitations_CoachId_RecipientEmail", table: "CoachInvitations", columns: ["CoachId", "RecipientEmail"]);
        migrationBuilder.CreateIndex(name: "IX_ProgramTemplates_CoachId_Name", table: "ProgramTemplates", columns: ["CoachId", "Name"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_ProgramTemplateWeeks_ProgramTemplateId_WeekNumber", table: "ProgramTemplateWeeks", columns: ["ProgramTemplateId", "WeekNumber"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_ProgramTemplateDays_ProgramTemplateWeekId_DayNumber", table: "ProgramTemplateDays", columns: ["ProgramTemplateWeekId", "DayNumber"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_ProgramTemplateExercises_ProgramTemplateDayId_SortOrder", table: "ProgramTemplateExercises", columns: ["ProgramTemplateDayId", "SortOrder"], unique: true);
        migrationBuilder.CreateIndex(name: "IX_AthleteProfiles_PlatformUserId", table: "AthleteProfiles", column: "PlatformUserId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_TrainingBlocks_CoachId", table: "TrainingBlocks", column: "CoachId");
        migrationBuilder.CreateIndex(name: "IX_TrainingBlocks_ProgramTemplateId", table: "TrainingBlocks", column: "ProgramTemplateId");

        migrationBuilder.AddForeignKey(name: "FK_AthleteProfiles_PlatformUsers_PlatformUserId", table: "AthleteProfiles", column: "PlatformUserId", principalTable: "PlatformUsers", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
        migrationBuilder.AddForeignKey(name: "FK_TrainingBlocks_PlatformUsers_CoachId", table: "TrainingBlocks", column: "CoachId", principalTable: "PlatformUsers", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
        migrationBuilder.AddForeignKey(name: "FK_TrainingBlocks_ProgramTemplates_ProgramTemplateId", table: "TrainingBlocks", column: "ProgramTemplateId", principalTable: "ProgramTemplates", principalColumn: "Id", onDelete: ReferentialAction.SetNull);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: "FK_AthleteProfiles_PlatformUsers_PlatformUserId", table: "AthleteProfiles");
        migrationBuilder.DropForeignKey(name: "FK_TrainingBlocks_PlatformUsers_CoachId", table: "TrainingBlocks");
        migrationBuilder.DropForeignKey(name: "FK_TrainingBlocks_ProgramTemplates_ProgramTemplateId", table: "TrainingBlocks");
        migrationBuilder.DropTable(name: "CoachInvitations");
        migrationBuilder.DropTable(name: "ProgramTemplateExercises");
        migrationBuilder.DropTable(name: "ProgramTemplateDays");
        migrationBuilder.DropTable(name: "ProgramTemplateWeeks");
        migrationBuilder.DropTable(name: "ProgramTemplates");
        migrationBuilder.DropTable(name: "PlatformUsers");
        migrationBuilder.DropIndex(name: "IX_AthleteProfiles_PlatformUserId", table: "AthleteProfiles");
        migrationBuilder.DropIndex(name: "IX_TrainingBlocks_CoachId", table: "TrainingBlocks");
        migrationBuilder.DropIndex(name: "IX_TrainingBlocks_ProgramTemplateId", table: "TrainingBlocks");
        migrationBuilder.DropColumn(name: "PlatformUserId", table: "AthleteProfiles");
        migrationBuilder.DropColumn(name: "CoachId", table: "TrainingBlocks");
        migrationBuilder.DropColumn(name: "ProgramTemplateId", table: "TrainingBlocks");
        migrationBuilder.DropColumn(name: "PrescriptionMode", table: "PrescribedExercises");
        migrationBuilder.DropColumn(name: "PrescriptionValue", table: "PrescribedExercises");
        migrationBuilder.DropColumn(name: "WeightUnit", table: "PrescribedExercises");
    }
}