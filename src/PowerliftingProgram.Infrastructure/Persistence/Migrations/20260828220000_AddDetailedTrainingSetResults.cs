using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260828220000_AddDetailedTrainingSetResults")]
public sealed class AddDetailedTrainingSetResults : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(name: "MeanVelocityMps", table: "TrainingSets", type: "numeric(4,3)", precision: 4, scale: 3, nullable: true);
        migrationBuilder.AddColumn<int>(name: "RestSeconds", table: "TrainingSets", type: "integer", nullable: true);
        migrationBuilder.AddColumn<int>(name: "OutcomeReason", table: "TrainingSets", type: "integer", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "MeanVelocityMps", table: "TrainingSets");
        migrationBuilder.DropColumn(name: "RestSeconds", table: "TrainingSets");
        migrationBuilder.DropColumn(name: "OutcomeReason", table: "TrainingSets");
    }
}