using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260830130000_AddTrainingBlockAcceptance")]
public sealed class AddTrainingBlockAcceptance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "Status",
            table: "TrainingBlocks",
            type: "integer",
            nullable: false,
            defaultValue: 1);
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "RespondedAt",
            table: "TrainingBlocks",
            type: "timestamp with time zone",
            nullable: true);
        migrationBuilder.CreateIndex(
            name: "IX_TrainingBlocks_AthleteProfileId_Status",
            table: "TrainingBlocks",
            columns: new[] { "AthleteProfileId", "Status" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_TrainingBlocks_AthleteProfileId_Status", table: "TrainingBlocks");
        migrationBuilder.DropColumn(name: "Status", table: "TrainingBlocks");
        migrationBuilder.DropColumn(name: "RespondedAt", table: "TrainingBlocks");
    }
}