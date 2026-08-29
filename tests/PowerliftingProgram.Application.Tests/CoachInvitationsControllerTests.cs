using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PowerliftingProgram.Api.Controllers;
using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;
using Xunit;

namespace PowerliftingProgram.Application.Tests;

public sealed class CoachInvitationsControllerTests
{
    [Fact]
    public async Task GetAthletes_WhenLegacyAthleteHasNoProfile_ReturnsOnlyValidProfiles()
    {
        await using var database = CreateDatabase();
        var coach = CreateCoach();
        var validAthlete = CreateAthlete(coach.Id, "valid@example.com", "Valid Athlete");
        var legacyAthlete = CreateAthlete(coach.Id, "legacy@example.com", "Legacy Athlete");
        var profile = new AthleteProfile
        {
            PlatformUserId = validAthlete.Id,
            ExternalUserId = $"platform-{validAthlete.Id}",
            DisplayName = validAthlete.DisplayName,
            Sex = AthleteSex.PreferNotToSay,
            CompetitionWeightClass = "Unspecified"
        };
        var validAssignment = CreateAssignment(coach, validAthlete);
        var legacyAssignment = CreateAssignment(coach, legacyAthlete);
        database.AddRange(coach, validAthlete, legacyAthlete, profile, validAssignment, legacyAssignment);
        await database.SaveChangesAsync();
        var controller = CreateController(database, coach.Id);

        var result = await controller.GetAthletes(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var athletes = Assert.IsAssignableFrom<IReadOnlyList<CoachAthleteResponse>>(ok.Value);
        var athlete = Assert.Single(athletes);
        Assert.Equal(validAthlete.Id, athlete.UserId);
        Assert.Equal(profile.Id, athlete.AthleteProfileId);
    }

    [Fact]
    public async Task CreateInvitation_WhenEmailIsNotDelivered_ReturnsRegistrationLink()
    {
        await using var database = CreateDatabase();
        var coach = CreateCoach();
        database.PlatformUsers.Add(coach);
        await database.SaveChangesAsync();
        var emailService = new UndeliveredInvitationEmailService();
        var controller = CreateController(database, coach.Id, emailService);

        var result = await controller.CreateInvitation(new CreateCoachInvitationRequest("athlete@example.com"), CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result.Result);
        var response = Assert.IsType<CoachInvitationResponse>(created.Value);
        Assert.False(response.EmailSent);
        Assert.StartsWith("https://example.test/register?token=", response.AcceptanceUrl);
        Assert.False(response.RecipientHasAccount);
        Assert.Equal(response.AcceptanceUrl, emailService.RegistrationUrl);
        var storedInvitations = await database.CoachInvitations.ToListAsync();
        var storedInvitation = Assert.Single(storedInvitations);
        var rawToken = new Uri(response.AcceptanceUrl).Query.Split('=', 2)[1];
        Assert.NotEqual(rawToken, storedInvitation.TokenHash);
    }

    [Fact]
    public async Task CreateInvitation_ForExistingCoach_ReturnsInvitationLink()
    {
        await using var database = CreateDatabase();
        var coach = CreateCoach();
        var existingCoach = new PlatformUser
        {
            Email = "coach2@example.com",
            NormalizedEmail = "COACH2@EXAMPLE.COM",
            DisplayName = "Coach Two",
            PasswordHash = "existing-password-hash",
            Role = PlatformRole.Coach,
            CanCoach = true
        };
        database.AddRange(coach, existingCoach);
        await database.SaveChangesAsync();
        var controller = CreateController(database, coach.Id);

        var result = await controller.CreateInvitation(new CreateCoachInvitationRequest(existingCoach.Email), CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result.Result);
        var response = Assert.IsType<CoachInvitationResponse>(created.Value);
        Assert.True(response.RecipientHasAccount);
        Assert.StartsWith("https://example.test/invitation?token=", response.AcceptanceUrl);
    }

    [Fact]
    public async Task CreateInvitation_WhenPendingInviteExists_RejectsDuplicate()
    {
        await using var database = CreateDatabase();
        var coach = CreateCoach();
        var invitation = new CoachInvitation
        {
            CoachId = coach.Id,
            RecipientEmail = "ATHLETE@EXAMPLE.COM",
            TokenHash = "existing-token-hash",
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1),
            Role = CoachingRole.Strength
        };
        database.AddRange(coach, invitation);
        await database.SaveChangesAsync();
        var controller = CreateController(database, coach.Id);

        var result = await controller.CreateInvitation(new CreateCoachInvitationRequest("athlete@example.com"), CancellationToken.None);

        Assert.Equal(400, Assert.IsAssignableFrom<ObjectResult>(result.Result).StatusCode);
        Assert.Single(await database.CoachInvitations.ToListAsync());
    }

    private static CoachInvitationsController CreateController(TrainingDbContext database, Guid coachId, IInvitationEmailService? emailService = null)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Client:RegistrationUrl"] = "https://example.test/register"
            , ["Client:InvitationUrl"] = "https://example.test/invitation"
        }).Build();
        return new CoachInvitationsController(database, emailService ?? new UndeliveredInvitationEmailService(), configuration)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, coachId.ToString()),
                        new Claim(ClaimTypes.Role, "COACH")
                    ], "test"))
                }
            }
        };
    }

    private static PlatformUser CreateCoach() => new()
    {
        Email = "coach@example.com",
        NormalizedEmail = "COACH@EXAMPLE.COM",
        DisplayName = "Test Coach",
        PasswordHash = "not-used",
        Role = PlatformRole.Coach,
        CanCoach = true
    };

    private static PlatformUser CreateAthlete(Guid coachId, string email, string displayName) => new()
    {
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        DisplayName = displayName,
        PasswordHash = "not-used",
        Role = PlatformRole.Athlete,
        CoachId = coachId
    };

    private static CoachingAssignment CreateAssignment(PlatformUser coach, PlatformUser athlete) => new()
    {
        CoachId = coach.Id,
        AthleteUserId = athlete.Id,
        Role = CoachingRole.Strength,
        AccessLevel = CoachingAccessLevel.Full,
        Status = CoachingAssignmentStatus.Active,
        IsPrimary = true
    };

    private static TrainingDbContext CreateDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TrainingDbContext(options);
    }

    private sealed class UndeliveredInvitationEmailService : IInvitationEmailService
    {
        public string? RegistrationUrl { get; private set; }

        public Task<bool> SendAsync(string recipientEmail, string coachName, string registrationUrl, CancellationToken cancellationToken)
        {
            RegistrationUrl = registrationUrl;
            return Task.FromResult(false);
        }
    }
}