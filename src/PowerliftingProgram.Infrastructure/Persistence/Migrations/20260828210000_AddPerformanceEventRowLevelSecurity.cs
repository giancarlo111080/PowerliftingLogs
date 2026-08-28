using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260828210000_AddPerformanceEventRowLevelSecurity")]
public sealed class AddPerformanceEventRowLevelSecurity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "PerformanceEvents" ENABLE ROW LEVEL SECURITY;
            ALTER TABLE "PerformanceEvents" FORCE ROW LEVEL SECURITY;

            CREATE POLICY "PerformanceEvents_TenantIsolation"
            ON "PerformanceEvents"
            FOR ALL
            USING (
                "TenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
            )
            WITH CHECK (
                "TenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP POLICY IF EXISTS "PerformanceEvents_TenantIsolation" ON "PerformanceEvents";
            ALTER TABLE "PerformanceEvents" NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE "PerformanceEvents" DISABLE ROW LEVEL SECURITY;
            """);
    }
}