using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

#nullable disable

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260828200000_AddPerformanceEvents")]
public partial class AddPerformanceEvents : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "PerformanceEvents",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                AthleteProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                Kind = table.Column<int>(type: "integer", nullable: false),
                OccurredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Source = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                SchemaVersion = table.Column<int>(type: "integer", nullable: false),
                Provenance = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                CorrelationId = table.Column<Guid>(type: "uuid", nullable: true),
                StableKey = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RowVersion = table.Column<byte[]>(type: "bytea", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PerformanceEvents", item => item.Id);
                table.ForeignKey(
                    name: "FK_PerformanceEvents_AthleteProfiles_AthleteProfileId",
                    column: item => item.AthleteProfileId,
                    principalTable: "AthleteProfiles",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_PerformanceEvents_PlatformUsers_ActorUserId",
                    column: item => item.ActorUserId,
                    principalTable: "PlatformUsers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(name: "IX_PerformanceEvents_ActorUserId", table: "PerformanceEvents", column: "ActorUserId");
        migrationBuilder.CreateIndex(name: "IX_PerformanceEvents_AthleteProfileId", table: "PerformanceEvents", column: "AthleteProfileId");
        migrationBuilder.CreateIndex(name: "IX_PerformanceEvents_CorrelationId", table: "PerformanceEvents", column: "CorrelationId");
        migrationBuilder.CreateIndex(
            name: "IX_PerformanceEvents_TenantId_AthleteProfileId_Kind_OccurredAtUtc",
            table: "PerformanceEvents",
            columns: ["TenantId", "AthleteProfileId", "Kind", "OccurredAtUtc"]);
        migrationBuilder.CreateIndex(
            name: "IX_PerformanceEvents_TenantId_StableKey",
            table: "PerformanceEvents",
            columns: ["TenantId", "StableKey"],
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "PerformanceEvents");
}