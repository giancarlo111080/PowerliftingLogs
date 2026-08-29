using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PowerliftingProgram.Infrastructure.Persistence;

namespace PowerliftingProgram.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrainingDbContext))]
[Migration("20260830000000_AddAthleteCareerHistory")]
public partial class AddAthleteCareerHistory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CountryCode",
            table: "AthleteProfiles",
            type: "character varying(2)",
            maxLength: 2,
            nullable: true);

        migrationBuilder.Sql("""
            CREATE TABLE "PowerliftingFederations" (
                "Id" uuid NOT NULL,
                "Code" character varying(32) NOT NULL,
                "Name" character varying(200) NOT NULL,
                "CountryCode" character varying(2) NOT NULL,
                "Scope" integer NOT NULL,
                "ParentFederationCode" character varying(32),
                "WebsiteUrl" character varying(2048),
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                "RowVersion" bytea,
                CONSTRAINT "PK_PowerliftingFederations" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX "IX_PowerliftingFederations_Code" ON "PowerliftingFederations" ("Code");

            CREATE TABLE "AthleteFederationMemberships" (
                "Id" uuid NOT NULL,
                "AthleteProfileId" uuid NOT NULL,
                "FederationId" uuid NOT NULL,
                "MembershipNumber" character varying(100),
                "Status" integer NOT NULL,
                "StartsOn" date NOT NULL,
                "EndsOn" date,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                "RowVersion" bytea,
                CONSTRAINT "PK_AthleteFederationMemberships" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_AthleteFederationMemberships_AthleteProfiles_AthleteProfileId" FOREIGN KEY ("AthleteProfileId") REFERENCES "AthleteProfiles" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_AthleteFederationMemberships_PowerliftingFederations_FederationId" FOREIGN KEY ("FederationId") REFERENCES "PowerliftingFederations" ("Id") ON DELETE RESTRICT
            );
            CREATE INDEX "IX_AthleteFederationMemberships_FederationId" ON "AthleteFederationMemberships" ("FederationId");
            CREATE UNIQUE INDEX "IX_AthleteFederationMemberships_AthleteProfileId_FederationId_StartsOn" ON "AthleteFederationMemberships" ("AthleteProfileId", "FederationId", "StartsOn");

            CREATE TABLE "QualificationStandards" (
                "Id" uuid NOT NULL,
                "FederationId" uuid NOT NULL,
                "Name" character varying(200) NOT NULL,
                "Scope" integer NOT NULL,
                "CompetitionDivision" character varying(80) NOT NULL,
                "EquipmentCategory" character varying(80) NOT NULL,
                "SexCategory" character varying(40) NOT NULL,
                "WeightClass" character varying(32) NOT NULL,
                "RequiredTotalKg" numeric(7,2) NOT NULL,
                "EffectiveFrom" date NOT NULL,
                "EffectiveTo" date,
                "SourceUrl" character varying(2048) NOT NULL,
                "SourceRetrievedAt" timestamp with time zone NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                "RowVersion" bytea,
                CONSTRAINT "PK_QualificationStandards" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_QualificationStandards_PowerliftingFederations_FederationId" FOREIGN KEY ("FederationId") REFERENCES "PowerliftingFederations" ("Id") ON DELETE RESTRICT
            );
            CREATE UNIQUE INDEX "IX_QualificationStandards_Version" ON "QualificationStandards" ("FederationId", "Name", "CompetitionDivision", "EquipmentCategory", "SexCategory", "WeightClass", "EffectiveFrom");

            CREATE TABLE "CompetitionResults" (
                "Id" uuid NOT NULL,
                "AthleteProfileId" uuid NOT NULL,
                "FederationId" uuid,
                "MeetName" character varying(200) NOT NULL,
                "CountryCode" character varying(2) NOT NULL,
                "MeetDate" date NOT NULL,
                "EquipmentCategory" character varying(80) NOT NULL,
                "WeightClass" character varying(32) NOT NULL,
                "BodyWeightKg" numeric(6,2) NOT NULL,
                "BestSquatKg" numeric(7,2) NOT NULL,
                "BestBenchKg" numeric(7,2) NOT NULL,
                "BestDeadliftKg" numeric(7,2) NOT NULL,
                "TotalKg" numeric(7,2) NOT NULL,
                "Dots" numeric(8,4),
                "Goodlift" numeric(8,4),
                "Place" integer,
                "SourceName" character varying(100) NOT NULL,
                "SourceRecordId" character varying(200),
                "SourceUrl" character varying(2048),
                "SourceRetrievedAt" timestamp with time zone NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                "RowVersion" bytea,
                CONSTRAINT "PK_CompetitionResults" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_CompetitionResults_AthleteProfiles_AthleteProfileId" FOREIGN KEY ("AthleteProfileId") REFERENCES "AthleteProfiles" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_CompetitionResults_PowerliftingFederations_FederationId" FOREIGN KEY ("FederationId") REFERENCES "PowerliftingFederations" ("Id") ON DELETE SET NULL
            );
            CREATE INDEX "IX_CompetitionResults_AthleteProfileId_MeetDate" ON "CompetitionResults" ("AthleteProfileId", "MeetDate");
            CREATE INDEX "IX_CompetitionResults_FederationId" ON "CompetitionResults" ("FederationId");
            CREATE UNIQUE INDEX "IX_CompetitionResults_SourceName_SourceRecordId" ON "CompetitionResults" ("SourceName", "SourceRecordId");

            CREATE TABLE "AthleteExternalIdentities" (
                "Id" uuid NOT NULL,
                "AthleteProfileId" uuid NOT NULL,
                "Provider" character varying(80) NOT NULL,
                "ExternalId" character varying(200) NOT NULL,
                "ProfileUrl" character varying(2048),
                "VerifiedByAthlete" boolean NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                "RowVersion" bytea,
                CONSTRAINT "PK_AthleteExternalIdentities" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_AthleteExternalIdentities_AthleteProfiles_AthleteProfileId" FOREIGN KEY ("AthleteProfileId") REFERENCES "AthleteProfiles" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX "IX_AthleteExternalIdentities_AthleteProfileId" ON "AthleteExternalIdentities" ("AthleteProfileId");
            CREATE UNIQUE INDEX "IX_AthleteExternalIdentities_Provider_ExternalId" ON "AthleteExternalIdentities" ("Provider", "ExternalId");

            CREATE TABLE "AthleteRankingSnapshots" (
                "Id" uuid NOT NULL,
                "AthleteProfileId" uuid NOT NULL,
                "RankingDate" date NOT NULL,
                "Scope" integer NOT NULL,
                "ScopeCode" character varying(32) NOT NULL,
                "EquipmentCategory" character varying(80) NOT NULL,
                "WeightClass" character varying(32) NOT NULL,
                "Metric" character varying(40) NOT NULL,
                "Score" numeric(10,4) NOT NULL,
                "Rank" integer NOT NULL,
                "RankedLifterCount" integer NOT NULL,
                "SourceName" character varying(100) NOT NULL,
                "SourceUrl" character varying(2048) NOT NULL,
                "SourceRetrievedAt" timestamp with time zone NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NOT NULL,
                "RowVersion" bytea,
                CONSTRAINT "PK_AthleteRankingSnapshots" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_AthleteRankingSnapshots_AthleteProfiles_AthleteProfileId" FOREIGN KEY ("AthleteProfileId") REFERENCES "AthleteProfiles" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX "IX_AthleteRankingSnapshots_Dimension" ON "AthleteRankingSnapshots" ("AthleteProfileId", "RankingDate", "Scope", "ScopeCode", "EquipmentCategory", "WeightClass", "Metric", "SourceName");

            INSERT INTO "PowerliftingFederations" ("Id", "Code", "Name", "CountryCode", "Scope", "ParentFederationCode", "CreatedAt", "UpdatedAt", "RowVersion")
            VALUES ('5bfa5937-d860-45e8-96f1-49223f715823', 'PAP', 'Powerlifting Association of the Philippines', 'PH', 0, 'IPF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, decode(md5(random()::text), 'hex'))
            ON CONFLICT ("Code") DO NOTHING;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS "AthleteRankingSnapshots";
            DROP TABLE IF EXISTS "AthleteExternalIdentities";
            DROP TABLE IF EXISTS "CompetitionResults";
            DROP TABLE IF EXISTS "QualificationStandards";
            DROP TABLE IF EXISTS "AthleteFederationMemberships";
            DROP TABLE IF EXISTS "PowerliftingFederations";
            """);
        migrationBuilder.DropColumn(name: "CountryCode", table: "AthleteProfiles");
    }
}