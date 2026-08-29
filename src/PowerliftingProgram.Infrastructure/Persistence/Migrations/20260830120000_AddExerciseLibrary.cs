using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260830120000_AddExerciseLibrary")]
public sealed class AddExerciseLibrary : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ExerciseLibraryItems",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CoachId = table.Column<Guid>(type: "uuid", nullable: true),
                Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                BodyPart = table.Column<int>(type: "integer", nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ExerciseLibraryItems", item => item.Id);
                table.ForeignKey("FK_ExerciseLibraryItems_PlatformUsers_CoachId", item => item.CoachId, "PlatformUsers", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("IX_ExerciseLibraryItems_BodyPart_Name", "ExerciseLibraryItems", new[] { "BodyPart", "Name" });
        migrationBuilder.CreateIndex("IX_ExerciseLibraryItems_CoachId_Name", "ExerciseLibraryItems", new[] { "CoachId", "Name" }, unique: true);

        migrationBuilder.Sql("""
            INSERT INTO "ExerciseLibraryItems" ("Id", "CoachId", "Name", "BodyPart", "IsActive", "CreatedAt", "UpdatedAt", "RowVersion")
            SELECT gen_random_uuid(), NULL, seed."Name", seed."BodyPart", TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, decode(md5(random()::text), 'hex')
            FROM (VALUES
                ('Barbell Row', 0), ('Chest-Supported Row', 0), ('Lat Pulldown', 0), ('Pull-Up', 0), ('Seated Cable Row', 0), ('Single-Arm Dumbbell Row', 0),
                ('Incline Bench Press', 1), ('Dumbbell Bench Press', 1), ('Machine Chest Press', 1), ('Cable Fly', 1), ('Push-Up', 1),
                ('Shoulder Press', 2), ('Dumbbell Shoulder Press', 2), ('Lateral Raise', 2), ('Rear Delt Fly', 2), ('Face Pull', 2),
                ('Barbell Curl', 3), ('Hammer Curl', 3), ('Triceps Pushdown', 3), ('Skull Crusher', 3), ('Close-Grip Bench Press', 3),
                ('Leg Press', 4), ('Hack Squat', 4), ('Bulgarian Split Squat', 4), ('Leg Extension', 4), ('Leg Curl', 4), ('Walking Lunge', 4),
                ('Hip Thrust', 5), ('Glute Bridge', 5), ('Cable Kickback', 5), ('Romanian Deadlift', 5),
                ('Plank', 6), ('Hanging Leg Raise', 6), ('Cable Crunch', 6), ('Pallof Press', 6)
            ) AS seed("Name", "BodyPart");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "ExerciseLibraryItems");
}
