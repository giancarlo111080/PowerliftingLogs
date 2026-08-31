using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

#nullable disable

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260831000000_AddAthleteCompetitionClassification")]
public partial class AddAthleteCompetitionClassification : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateOnly>("DateOfBirth", "AthleteProfiles", type: "date", nullable: true);
        migrationBuilder.AddColumn<int>("Experience", "AthleteProfiles", type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<int>("Equipment", "AthleteProfiles", type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<string>("FederationCode", "AthleteProfiles", type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "IPF");
        migrationBuilder.AddColumn<string>("CompetitionAgeDivision", "AthleteProfiles", type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "Open");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("DateOfBirth", "AthleteProfiles");
        migrationBuilder.DropColumn("Experience", "AthleteProfiles");
        migrationBuilder.DropColumn("Equipment", "AthleteProfiles");
        migrationBuilder.DropColumn("FederationCode", "AthleteProfiles");
        migrationBuilder.DropColumn("CompetitionAgeDivision", "AthleteProfiles");
    }
}