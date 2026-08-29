using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260829210000_AddCoachingAssignments")]
public partial class AddCoachingAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>("Role", "CoachInvitations", type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<int>("AccessLevel", "CoachInvitations", type: "integer", nullable: false, defaultValue: 3);
        migrationBuilder.AddColumn<bool>("IsPrimary", "CoachInvitations", type: "boolean", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<DateTimeOffset>("AssignmentEndsAt", "CoachInvitations", type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<string>("MovementScope", "CoachInvitations", type: "character varying(500)", maxLength: 500, nullable: true);

        migrationBuilder.CreateTable(
            name: "CoachingAssignments",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CoachId = table.Column<Guid>(type: "uuid", nullable: false),
                AthleteUserId = table.Column<Guid>(type: "uuid", nullable: false),
                Role = table.Column<int>(type: "integer", nullable: false),
                AccessLevel = table.Column<int>(type: "integer", nullable: false),
                Status = table.Column<int>(type: "integer", nullable: false),
                IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                MovementScope = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CoachingAssignments", item => item.Id);
                table.ForeignKey("FK_CoachingAssignments_PlatformUsers_AthleteUserId", item => item.AthleteUserId, "PlatformUsers", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_CoachingAssignments_PlatformUsers_CoachId", item => item.CoachId, "PlatformUsers", "Id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("IX_CoachingAssignments_AthleteUserId_Status", "CoachingAssignments", new[] { "AthleteUserId", "Status" });
        migrationBuilder.CreateIndex("IX_CoachingAssignments_CoachId_Status", "CoachingAssignments", new[] { "CoachId", "Status" });
        migrationBuilder.CreateIndex("IX_CoachingAssignments_CoachId_AthleteUserId_Role_Status", "CoachingAssignments", new[] { "CoachId", "AthleteUserId", "Role", "Status" });
        migrationBuilder.Sql("""
            INSERT INTO "CoachingAssignments" (
                "Id", "CoachId", "AthleteUserId", "Role", "AccessLevel", "Status", "IsPrimary",
                "StartsAt", "EndsAt", "MovementScope", "CreatedAt", "UpdatedAt", "RowVersion")
            SELECT gen_random_uuid(), "CoachId", "Id", 0, 3, 1, TRUE,
                   "CreatedAt", NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, decode(md5(random()::text), 'hex')
            FROM "PlatformUsers"
            WHERE "CoachId" IS NOT NULL
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "CoachingAssignments");
        migrationBuilder.DropColumn("Role", "CoachInvitations");
        migrationBuilder.DropColumn("AccessLevel", "CoachInvitations");
        migrationBuilder.DropColumn("IsPrimary", "CoachInvitations");
        migrationBuilder.DropColumn("AssignmentEndsAt", "CoachInvitations");
        migrationBuilder.DropColumn("MovementScope", "CoachInvitations");
    }
}