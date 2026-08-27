using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

#nullable disable

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260828120000_AddPasswordReset")]
public partial class AddPasswordReset : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "PasswordResetExpiresAt",
            table: "PlatformUsers",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "PasswordResetTokenHash",
            table: "PlatformUsers",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "SessionVersion",
            table: "PlatformUsers",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.CreateIndex(
            name: "IX_PlatformUsers_PasswordResetTokenHash",
            table: "PlatformUsers",
            column: "PasswordResetTokenHash",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_PlatformUsers_PasswordResetTokenHash",
            table: "PlatformUsers");

        migrationBuilder.DropColumn(name: "PasswordResetExpiresAt", table: "PlatformUsers");
        migrationBuilder.DropColumn(name: "PasswordResetTokenHash", table: "PlatformUsers");
        migrationBuilder.DropColumn(name: "SessionVersion", table: "PlatformUsers");
    }
}