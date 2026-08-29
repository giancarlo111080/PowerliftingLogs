namespace PowerliftingProgram.Domain.Entities;

public enum GeographicScope
{
    National = 0,
    Continental = 1,
    World = 2
}

public enum FederationMembershipStatus
{
    Active = 0,
    Expired = 1,
    Suspended = 2,
    Former = 3
}

public sealed class PowerliftingFederation : Entity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string CountryCode { get; set; }
    public GeographicScope Scope { get; set; }
    public string? ParentFederationCode { get; set; }
    public string? WebsiteUrl { get; set; }

    public ICollection<AthleteFederationMembership> AthleteMemberships { get; } = new List<AthleteFederationMembership>();
    public ICollection<QualificationStandard> QualificationStandards { get; } = new List<QualificationStandard>();
    public ICollection<CompetitionResult> CompetitionResults { get; } = new List<CompetitionResult>();
}

public sealed class AthleteFederationMembership : Entity
{
    public Guid AthleteProfileId { get; set; }
    public Guid FederationId { get; set; }
    public string? MembershipNumber { get; set; }
    public FederationMembershipStatus Status { get; set; } = FederationMembershipStatus.Active;
    public DateOnly StartsOn { get; set; }
    public DateOnly? EndsOn { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
    public PowerliftingFederation? Federation { get; set; }
}

public sealed class QualificationStandard : Entity
{
    public Guid FederationId { get; set; }
    public required string Name { get; set; }
    public GeographicScope Scope { get; set; }
    public required string CompetitionDivision { get; set; }
    public required string EquipmentCategory { get; set; }
    public required string SexCategory { get; set; }
    public required string WeightClass { get; set; }
    public decimal RequiredTotalKg { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public required string SourceUrl { get; set; }
    public DateTimeOffset SourceRetrievedAt { get; set; }

    public PowerliftingFederation? Federation { get; set; }
}

public sealed class CompetitionResult : Entity
{
    public Guid AthleteProfileId { get; set; }
    public Guid? FederationId { get; set; }
    public required string MeetName { get; set; }
    public required string CountryCode { get; set; }
    public DateOnly MeetDate { get; set; }
    public required string EquipmentCategory { get; set; }
    public required string WeightClass { get; set; }
    public decimal BodyWeightKg { get; set; }
    public decimal BestSquatKg { get; set; }
    public decimal BestBenchKg { get; set; }
    public decimal BestDeadliftKg { get; set; }
    public decimal TotalKg { get; set; }
    public decimal? Dots { get; set; }
    public decimal? Goodlift { get; set; }
    public int? Place { get; set; }
    public required string SourceName { get; set; }
    public string? SourceRecordId { get; set; }
    public string? SourceUrl { get; set; }
    public DateTimeOffset SourceRetrievedAt { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
    public PowerliftingFederation? Federation { get; set; }
}

public sealed class AthleteExternalIdentity : Entity
{
    public Guid AthleteProfileId { get; set; }
    public required string Provider { get; set; }
    public required string ExternalId { get; set; }
    public string? ProfileUrl { get; set; }
    public bool VerifiedByAthlete { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
}

public sealed class AthleteRankingSnapshot : Entity
{
    public Guid AthleteProfileId { get; set; }
    public DateOnly RankingDate { get; set; }
    public GeographicScope Scope { get; set; }
    public required string ScopeCode { get; set; }
    public required string EquipmentCategory { get; set; }
    public required string WeightClass { get; set; }
    public required string Metric { get; set; }
    public decimal Score { get; set; }
    public int Rank { get; set; }
    public int RankedLifterCount { get; set; }
    public required string SourceName { get; set; }
    public required string SourceUrl { get; set; }
    public DateTimeOffset SourceRetrievedAt { get; set; }

    public AthleteProfile? AthleteProfile { get; set; }
}