using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record UpdateAthleteCountryRequest(string? CountryCode);
public sealed record AddFederationMembershipRequest(string FederationCode, string? MembershipNumber, DateOnly StartsOn);
public sealed record LinkExternalIdentityRequest(string Provider, string ExternalId, string? ProfileUrl);

[Authorize]
[ApiController]
[Route("api/athletes/{athleteProfileId:guid}/career")]
public sealed class AthleteCareerController(TrainingDbContext database, CoachAccessService coachAccessService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<object>> GetCareer(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        if (!await CanReadAsync(athleteProfileId, cancellationToken)) return Forbid();

        var athlete = await database.AthleteProfiles.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == athleteProfileId, cancellationToken);
        if (athlete is null) return NotFound();

        var memberships = await database.AthleteFederationMemberships.AsNoTracking()
            .Where(item => item.AthleteProfileId == athleteProfileId)
            .Include(item => item.Federation)
            .OrderByDescending(item => item.StartsOn)
            .ToListAsync(cancellationToken);
        var results = await database.CompetitionResults.AsNoTracking()
            .Where(item => item.AthleteProfileId == athleteProfileId)
            .OrderByDescending(item => item.MeetDate)
            .ToListAsync(cancellationToken);
        var rankings = await database.AthleteRankingSnapshots.AsNoTracking()
            .Where(item => item.AthleteProfileId == athleteProfileId)
            .OrderByDescending(item => item.RankingDate)
            .ToListAsync(cancellationToken);
        var identities = await database.AthleteExternalIdentities.AsNoTracking()
            .Where(item => item.AthleteProfileId == athleteProfileId)
            .OrderBy(item => item.Provider)
            .ToListAsync(cancellationToken);
        var programs = await database.TrainingBlocks.AsNoTracking()
            .Where(item => item.AthleteProfileId == athleteProfileId)
            .Include(item => item.Coach)
            .OrderByDescending(item => item.StartsOn)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var availableFederations = await database.PowerliftingFederations.AsNoTracking()
            .Where(item => item.Scope == GeographicScope.National && item.CountryCode == athlete.CountryCode)
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);
        var federationIds = memberships
            .Where(item => item.Status == FederationMembershipStatus.Active
                && item.StartsOn <= today
                && (item.EndsOn == null || item.EndsOn >= today)
                && (item.Federation!.Scope != GeographicScope.National || item.Federation.CountryCode == athlete.CountryCode))
            .Select(item => item.FederationId)
            .Distinct()
            .ToList();
        var qualifierTotals = await database.QualificationStandards.AsNoTracking()
            .Where(item => federationIds.Contains(item.FederationId)
                && item.EffectiveFrom <= today
                && (item.EffectiveTo == null || item.EffectiveTo >= today)
                && item.SexCategory == athlete.Sex.ToString())
            .Include(item => item.Federation)
            .OrderBy(item => item.Scope)
            .ThenBy(item => item.Federation!.Code)
            .ThenBy(item => item.WeightClass)
            .ToListAsync(cancellationToken);
        var standards = qualifierTotals.Where(item => item.WeightClass == athlete.CompetitionWeightClass).ToList();
        var bestTotalKg = results.Select(item => item.TotalKg).DefaultIfEmpty(0).Max();

        return Ok(new
        {
            athlete.Id,
            athlete.DisplayName,
            athlete.CountryCode,
            athlete.Sex,
            athlete.CompetitionWeightClass,
            BestOfficialTotalKg = bestTotalKg,
            AvailableFederations = availableFederations.Select(item => new
            {
                item.Id,
                item.Code,
                item.Name,
                item.CountryCode,
                item.WebsiteUrl
            }),
            Memberships = memberships.Select(item => new
            {
                item.Id,
                FederationCode = item.Federation!.Code,
                FederationName = item.Federation.Name,
                item.MembershipNumber,
                item.Status,
                item.StartsOn,
                item.EndsOn
            }),
            QualificationProgress = standards.Select(item => new
            {
                item.Id,
                FederationCode = item.Federation!.Code,
                item.Name,
                item.Scope,
                item.CompetitionDivision,
                item.EquipmentCategory,
                item.RequiredTotalKg,
                GapKg = Math.Max(0, item.RequiredTotalKg - bestTotalKg),
                Qualified = bestTotalKg >= item.RequiredTotalKg,
                item.EffectiveFrom,
                item.EffectiveTo,
                item.SourceUrl,
                item.SourceRetrievedAt
            }),
            QualifierTotals = qualifierTotals.Select(item => new
            {
                item.Id,
                FederationCode = item.Federation!.Code,
                FederationName = item.Federation.Name,
                item.Name,
                item.Scope,
                item.CompetitionDivision,
                item.EquipmentCategory,
                item.SexCategory,
                item.WeightClass,
                QualifierTotalKg = item.RequiredTotalKg,
                item.EffectiveFrom,
                item.EffectiveTo,
                item.SourceUrl,
                item.SourceRetrievedAt
            }),
            Results = results,
            Rankings = rankings,
            ExternalIdentities = identities,
            ProgramHistory = programs.Select(item => new
            {
                item.Id,
                item.Name,
                item.Tag,
                item.StartsOn,
                item.EndsOn,
                item.IsActive,
                item.Status,
                item.CoachId,
                CoachName = item.Coach?.DisplayName
            })
        });
    }

    [HttpPatch("identity")]
    public async Task<IActionResult> UpdateIdentity(Guid athleteProfileId, UpdateAthleteCountryRequest request, CancellationToken cancellationToken)
    {
        if (!await IsAthleteOwnerAsync(athleteProfileId, cancellationToken)) return Forbid();
        var countryCode = request.CountryCode?.Trim().ToUpperInvariant();
        if (countryCode is not null && (countryCode.Length != 2 || !countryCode.All(char.IsLetter)))
        {
            ModelState.AddModelError(nameof(request.CountryCode), "Country code must be a two-letter ISO 3166-1 alpha-2 code.");
            return ValidationProblem(ModelState);
        }

        var athlete = await database.AthleteProfiles.SingleAsync(item => item.Id == athleteProfileId, cancellationToken);
        athlete.CountryCode = countryCode;
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("memberships")]
    public async Task<ActionResult<object>> AddMembership(Guid athleteProfileId, AddFederationMembershipRequest request, CancellationToken cancellationToken)
    {
        if (!await IsAthleteOwnerAsync(athleteProfileId, cancellationToken)) return Forbid();
        var code = request.FederationCode.Trim().ToUpperInvariant();
        var federation = await database.PowerliftingFederations.SingleOrDefaultAsync(item => item.Code == code, cancellationToken);
        if (federation is null)
        {
            ModelState.AddModelError(nameof(request.FederationCode), "Federation code is not recognized.");
            return ValidationProblem(ModelState);
        }
        var athlete = await database.AthleteProfiles.AsNoTracking()
            .SingleAsync(item => item.Id == athleteProfileId, cancellationToken);
        if (federation.Scope == GeographicScope.National && !string.Equals(federation.CountryCode, athlete.CountryCode, StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError(nameof(request.FederationCode), "This national federation does not match the athlete's country.");
            return ValidationProblem(ModelState);
        }

        var membership = new AthleteFederationMembership
        {
            AthleteProfileId = athleteProfileId,
            FederationId = federation.Id,
            MembershipNumber = string.IsNullOrWhiteSpace(request.MembershipNumber) ? null : request.MembershipNumber.Trim(),
            StartsOn = request.StartsOn
        };
        database.AthleteFederationMemberships.Add(membership);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetCareer), new { athleteProfileId }, new { membership.Id });
    }

    [HttpPost("external-identities")]
    public async Task<ActionResult<object>> LinkExternalIdentity(Guid athleteProfileId, LinkExternalIdentityRequest request, CancellationToken cancellationToken)
    {
        if (!await IsAthleteOwnerAsync(athleteProfileId, cancellationToken)) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Provider) || string.IsNullOrWhiteSpace(request.ExternalId))
        {
            ModelState.AddModelError(nameof(request.ExternalId), "Provider and external ID are required.");
            return ValidationProblem(ModelState);
        }

        var identity = new AthleteExternalIdentity
        {
            AthleteProfileId = athleteProfileId,
            Provider = request.Provider.Trim(),
            ExternalId = request.ExternalId.Trim(),
            ProfileUrl = string.IsNullOrWhiteSpace(request.ProfileUrl) ? null : request.ProfileUrl.Trim(),
            VerifiedByAthlete = true
        };
        database.AthleteExternalIdentities.Add(identity);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetCareer), new { athleteProfileId }, new { identity.Id });
    }

    private async Task<bool> CanReadAsync(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        var actorId = CoachAccessService.CurrentUserId(User);
        if (actorId is null) return false;
        return await database.AthleteProfiles.AnyAsync(item => item.Id == athleteProfileId && item.PlatformUserId == actorId, cancellationToken)
            || await coachAccessService.CoachOwnsAthleteAsync(actorId.Value, athleteProfileId, cancellationToken);
    }

    private async Task<bool> IsAthleteOwnerAsync(Guid athleteProfileId, CancellationToken cancellationToken)
    {
        var actorId = CoachAccessService.CurrentUserId(User);
        return actorId is not null && await database.AthleteProfiles
            .AnyAsync(item => item.Id == athleteProfileId && item.PlatformUserId == actorId, cancellationToken);
    }
}