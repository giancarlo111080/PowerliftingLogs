using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Infrastructure.Persistence.Configurations;

public sealed class PowerliftingFederationConfiguration : IEntityTypeConfiguration<PowerliftingFederation>
{
    public void Configure(EntityTypeBuilder<PowerliftingFederation> builder)
    {
        builder.ConfigureEntity();
        builder.Property(item => item.Code).HasMaxLength(32).IsRequired();
        builder.Property(item => item.Name).HasMaxLength(200).IsRequired();
        builder.Property(item => item.CountryCode).HasMaxLength(2).IsRequired();
        builder.Property(item => item.ParentFederationCode).HasMaxLength(32);
        builder.Property(item => item.WebsiteUrl).HasMaxLength(2048);
        builder.HasIndex(item => item.Code).IsUnique();
    }
}

public sealed class AthleteFederationMembershipConfiguration : IEntityTypeConfiguration<AthleteFederationMembership>
{
    public void Configure(EntityTypeBuilder<AthleteFederationMembership> builder)
    {
        builder.ConfigureEntity();
        builder.Property(item => item.MembershipNumber).HasMaxLength(100);
        builder.HasIndex(item => new { item.AthleteProfileId, item.FederationId, item.StartsOn }).IsUnique();
        builder.HasOne(item => item.AthleteProfile).WithMany(profile => profile.FederationMemberships)
            .HasForeignKey(item => item.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(item => item.Federation).WithMany(federation => federation.AthleteMemberships)
            .HasForeignKey(item => item.FederationId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class QualificationStandardConfiguration : IEntityTypeConfiguration<QualificationStandard>
{
    public void Configure(EntityTypeBuilder<QualificationStandard> builder)
    {
        builder.ConfigureEntity();
        builder.Property(item => item.Name).HasMaxLength(200).IsRequired();
        builder.Property(item => item.CompetitionDivision).HasMaxLength(80).IsRequired();
        builder.Property(item => item.EquipmentCategory).HasMaxLength(80).IsRequired();
        builder.Property(item => item.SexCategory).HasMaxLength(40).IsRequired();
        builder.Property(item => item.WeightClass).HasMaxLength(32).IsRequired();
        builder.Property(item => item.RequiredTotalKg).HasPrecision(7, 2);
        builder.Property(item => item.SourceUrl).HasMaxLength(2048).IsRequired();
        builder.HasIndex(item => new { item.FederationId, item.Name, item.CompetitionDivision, item.EquipmentCategory, item.SexCategory, item.WeightClass, item.EffectiveFrom }).IsUnique();
        builder.HasOne(item => item.Federation).WithMany(federation => federation.QualificationStandards)
            .HasForeignKey(item => item.FederationId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CompetitionResultConfiguration : IEntityTypeConfiguration<CompetitionResult>
{
    public void Configure(EntityTypeBuilder<CompetitionResult> builder)
    {
        builder.ConfigureEntity();
        builder.Property(item => item.MeetName).HasMaxLength(200).IsRequired();
        builder.Property(item => item.CountryCode).HasMaxLength(2).IsRequired();
        builder.Property(item => item.EquipmentCategory).HasMaxLength(80).IsRequired();
        builder.Property(item => item.WeightClass).HasMaxLength(32).IsRequired();
        builder.Property(item => item.SourceName).HasMaxLength(100).IsRequired();
        builder.Property(item => item.SourceRecordId).HasMaxLength(200);
        builder.Property(item => item.SourceUrl).HasMaxLength(2048);
        builder.Property(item => item.BodyWeightKg).HasPrecision(6, 2);
        builder.Property(item => item.BestSquatKg).HasPrecision(7, 2);
        builder.Property(item => item.BestBenchKg).HasPrecision(7, 2);
        builder.Property(item => item.BestDeadliftKg).HasPrecision(7, 2);
        builder.Property(item => item.TotalKg).HasPrecision(7, 2);
        builder.Property(item => item.Dots).HasPrecision(8, 4);
        builder.Property(item => item.Goodlift).HasPrecision(8, 4);
        builder.HasIndex(item => new { item.AthleteProfileId, item.MeetDate });
        builder.HasIndex(item => new { item.SourceName, item.SourceRecordId }).IsUnique();
        builder.HasOne(item => item.AthleteProfile).WithMany(profile => profile.CompetitionResults)
            .HasForeignKey(item => item.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(item => item.Federation).WithMany(federation => federation.CompetitionResults)
            .HasForeignKey(item => item.FederationId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class AthleteExternalIdentityConfiguration : IEntityTypeConfiguration<AthleteExternalIdentity>
{
    public void Configure(EntityTypeBuilder<AthleteExternalIdentity> builder)
    {
        builder.ConfigureEntity();
        builder.Property(item => item.Provider).HasMaxLength(80).IsRequired();
        builder.Property(item => item.ExternalId).HasMaxLength(200).IsRequired();
        builder.Property(item => item.ProfileUrl).HasMaxLength(2048);
        builder.HasIndex(item => new { item.Provider, item.ExternalId }).IsUnique();
        builder.HasOne(item => item.AthleteProfile).WithMany(profile => profile.ExternalIdentities)
            .HasForeignKey(item => item.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class AthleteRankingSnapshotConfiguration : IEntityTypeConfiguration<AthleteRankingSnapshot>
{
    public void Configure(EntityTypeBuilder<AthleteRankingSnapshot> builder)
    {
        builder.ConfigureEntity();
        builder.Property(item => item.ScopeCode).HasMaxLength(32).IsRequired();
        builder.Property(item => item.EquipmentCategory).HasMaxLength(80).IsRequired();
        builder.Property(item => item.WeightClass).HasMaxLength(32).IsRequired();
        builder.Property(item => item.Metric).HasMaxLength(40).IsRequired();
        builder.Property(item => item.Score).HasPrecision(10, 4);
        builder.Property(item => item.SourceName).HasMaxLength(100).IsRequired();
        builder.Property(item => item.SourceUrl).HasMaxLength(2048).IsRequired();
        builder.HasIndex(item => new { item.AthleteProfileId, item.RankingDate, item.Scope, item.ScopeCode, item.EquipmentCategory, item.WeightClass, item.Metric, item.SourceName }).IsUnique();
        builder.HasOne(item => item.AthleteProfile).WithMany(profile => profile.RankingSnapshots)
            .HasForeignKey(item => item.AthleteProfileId).OnDelete(DeleteBehavior.Cascade);
    }
}