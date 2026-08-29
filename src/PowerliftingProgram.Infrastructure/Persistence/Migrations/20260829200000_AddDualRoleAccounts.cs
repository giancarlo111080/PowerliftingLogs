using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260829200000_AddDualRoleAccounts")]
public partial class AddDualRoleAccounts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "CanCoach",
            table: "PlatformUsers",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.Sql("UPDATE \"PlatformUsers\" SET \"CanCoach\" = TRUE WHERE \"Role\" = 0");
        migrationBuilder.Sql("""
            INSERT INTO "AthleteProfiles" (
                "Id", "PlatformUserId", "ExternalUserId", "DisplayName", "Sex", "CompetitionWeightClass",
                "BodyWeightKg", "SquatOneRepMaxKg", "BenchOneRepMaxKg", "DeadliftOneRepMaxKg",
                "ExperiencePoints", "CurrentWorkoutStreak", "CumulativeWorkingSetTonnageKg", "CreatedAt", "UpdatedAt", "RowVersion")
            SELECT gen_random_uuid(), user_record."Id", 'platform-' || user_record."Id", user_record."DisplayName", 2, 'Unspecified',
                   0, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, decode(md5(random()::text), 'hex')
            FROM "PlatformUsers" AS user_record
            WHERE NOT EXISTS (
                SELECT 1 FROM "AthleteProfiles" AS profile WHERE profile."PlatformUserId" = user_record."Id"
            )
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "CanCoach", table: "PlatformUsers");
    }
}