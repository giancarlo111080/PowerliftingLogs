using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
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

public sealed class AuthenticationControllerTests
{
    [Fact]
    public async Task RegisterCoach_WithoutCoachAssignment_DoesNotGrantTrainingWorkspace()
    {
        await using var database = CreateDatabase();
        var controller = CreateController(database, new RecordingPasswordResetEmailService());

        var result = await controller.Register(
            new RegisterRequest("Ogee", "ogee@example.com", "OriginalPassword!", "ph", PlatformRole.Coach, null),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var session = Assert.IsType<SessionResponse>(created.Value);
        Assert.True(session.Account.CanCoach);
        Assert.False(session.Account.CanTrain);
        Assert.Equal("PH", session.Account.CountryCode);
        Assert.Equal("PH", (await database.AthleteProfiles.SingleAsync()).CountryCode);
    }

    [Fact]
    public async Task Login_WithInvitation_TransfersExistingUserToInvitingCoach()
    {
        await using var database = CreateDatabase();
        var passwordHasher = new PasswordHashingService();
        var formerCoach = CreateUser(passwordHasher.Hash("UnusedPassword!"));
        var invitingCoach = CreateUser(passwordHasher.Hash("UnusedPassword!"));
        invitingCoach.CanCoach = true;
        invitingCoach.Role = PlatformRole.Coach;
        var user = CreateUser(passwordHasher.Hash("OriginalPassword!"));
        user.CanCoach = true;
        user.Role = PlatformRole.Coach;
        user.CoachId = formerCoach.Id;
        var formerAssignment = new CoachingAssignment
        {
            CoachId = formerCoach.Id,
            AthleteUserId = user.Id,
            Role = CoachingRole.Strength,
            AccessLevel = CoachingAccessLevel.Full,
            Status = CoachingAssignmentStatus.Active,
            IsPrimary = true
        };
        var specialistAssignment = new CoachingAssignment
        {
            CoachId = formerCoach.Id,
            AthleteUserId = user.Id,
            Role = CoachingRole.Nutrition,
            AccessLevel = CoachingAccessLevel.Comment,
            Status = CoachingAssignmentStatus.Active
        };
        const string rawToken = "transfer-token";
        var invitation = new CoachInvitation
        {
            CoachId = invitingCoach.Id,
            RecipientEmail = user.NormalizedEmail,
            TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))),
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1)
        };
        database.AddRange(formerCoach, invitingCoach, user, invitation, formerAssignment, specialistAssignment);
        await database.SaveChangesAsync();
        var controller = CreateController(database, new RecordingPasswordResetEmailService(), passwordHasher);

        var result = await controller.Login(new LoginRequest(user.Email, "OriginalPassword!", rawToken), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var session = Assert.IsType<SessionResponse>(ok.Value);
        Assert.Equal(invitingCoach.Id, user.CoachId);
        Assert.True(user.CanCoach);
        Assert.True(session.Account.CanTrain);
        Assert.NotNull(invitation.AcceptedAt);
        Assert.Equal(CoachingAssignmentStatus.Completed, formerAssignment.Status);
        Assert.NotNull(formerAssignment.EndsAt);
        Assert.Equal(CoachingAssignmentStatus.Active, specialistAssignment.Status);
        Assert.Contains(await database.CoachingAssignments.ToListAsync(), assignment =>
            assignment.CoachId == invitingCoach.Id && assignment.AthleteUserId == user.Id && assignment.IsPrimary);
    }

    [Fact]
    public async Task InvitationContext_ForExistingAccount_DirectsUserToSignIn()
    {
        await using var database = CreateDatabase();
        var passwordHasher = new PasswordHashingService();
        var coach = CreateUser(passwordHasher.Hash("UnusedPassword!"));
        coach.Email = "coach@example.com";
        coach.NormalizedEmail = "COACH@EXAMPLE.COM";
        coach.DisplayName = "Test Coach";
        coach.Role = PlatformRole.Coach;
        coach.CanCoach = true;
        var existingUser = CreateUser(passwordHasher.Hash("OriginalPassword!"));
        existingUser.NormalizedEmail = "LEGACY-NORMALIZED-VALUE";
        const string rawToken = "existing-account-token";
        var invitation = new CoachInvitation
        {
            CoachId = coach.Id,
            RecipientEmail = existingUser.Email.ToUpperInvariant(),
            TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))),
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1),
            Role = CoachingRole.Strength,
            AccessLevel = CoachingAccessLevel.Full,
            IsPrimary = true
        };
        database.AddRange(coach, existingUser, invitation);
        await database.SaveChangesAsync();
        var controller = CreateController(database, new RecordingPasswordResetEmailService(), passwordHasher);

        var result = await controller.InvitationContext(rawToken, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var context = Assert.IsType<InvitationContextResponse>(ok.Value);
        Assert.True(context.ExistingAccount);
        Assert.Equal(existingUser.Email.ToUpperInvariant(), context.RecipientEmail);
        Assert.Equal(CoachingRole.Strength, context.Role);
        Assert.True(context.IsPrimary);
    }

    [Fact]
    public async Task AcceptInvitation_ExistingCoachKeepsCredentialsAndGainsTrainingAccess()
    {
        await using var database = CreateDatabase();
        var passwordHasher = new PasswordHashingService();
        var coachOne = CreateUser(passwordHasher.Hash("UnusedPassword!"));
        coachOne.Email = "coach1@example.com";
        coachOne.NormalizedEmail = "COACH1@EXAMPLE.COM";
        coachOne.DisplayName = "Coach One";
        coachOne.Role = PlatformRole.Coach;
        coachOne.CanCoach = true;
        var coachTwo = CreateUser(passwordHasher.Hash("ExistingPassword!"));
        coachTwo.Email = "coach2@example.com";
        coachTwo.NormalizedEmail = "COACH2@EXAMPLE.COM";
        coachTwo.DisplayName = "Coach Two";
        coachTwo.Role = PlatformRole.Coach;
        coachTwo.CanCoach = true;
        var originalPasswordHash = coachTwo.PasswordHash;
        var profile = new AthleteProfile
        {
            PlatformUserId = coachTwo.Id,
            ExternalUserId = $"platform-{coachTwo.Id}",
            DisplayName = coachTwo.DisplayName,
            Sex = AthleteSex.PreferNotToSay,
            CompetitionWeightClass = "Unspecified"
        };
        coachTwo.AthleteProfile = profile;
        const string rawToken = "coach-two-invitation";
        var invitation = new CoachInvitation
        {
            CoachId = coachOne.Id,
            RecipientEmail = coachTwo.NormalizedEmail,
            TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))),
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1),
            Role = CoachingRole.Strength,
            AccessLevel = CoachingAccessLevel.Full,
            IsPrimary = true
        };
        database.AddRange(coachOne, coachTwo, profile, invitation);
        await database.SaveChangesAsync();
        var controller = CreateController(database, new RecordingPasswordResetEmailService(), passwordHasher);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, coachTwo.Id.ToString()),
                    new Claim(ClaimTypes.Role, "COACH")
                ], "test"))
            }
        };

        var result = await controller.AcceptInvitation(rawToken, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var account = Assert.IsType<AccountResponse>(ok.Value);
        Assert.True(account.CanCoach);
        Assert.True(account.CanTrain);
        Assert.Equal(PlatformRole.Coach, account.Role);
        Assert.Equal(coachOne.Id, account.CoachId);
        Assert.Equal(originalPasswordHash, coachTwo.PasswordHash);
        Assert.NotNull(invitation.AcceptedAt);
        Assert.Contains(await database.CoachingAssignments.ToListAsync(), assignment =>
            assignment.CoachId == coachOne.Id && assignment.AthleteUserId == coachTwo.Id && assignment.IsPrimary);
    }

    [Fact]
    public async Task LeaveCoach_ClearsRelationshipWithoutRemovingCoachingCapability()
    {
        await using var database = CreateDatabase();
        var passwordHasher = new PasswordHashingService();
        var coach = CreateUser(passwordHasher.Hash("UnusedPassword!"));
        coach.CanCoach = true;
        coach.Role = PlatformRole.Coach;
        var user = CreateUser(passwordHasher.Hash("OriginalPassword!"));
        user.CanCoach = true;
        user.Role = PlatformRole.Coach;
        user.CoachId = coach.Id;
        var assignment = new CoachingAssignment
        {
            CoachId = coach.Id,
            AthleteUserId = user.Id,
            Role = CoachingRole.Strength,
            AccessLevel = CoachingAccessLevel.Full,
            Status = CoachingAssignmentStatus.Active,
            IsPrimary = true
        };
        database.AddRange(coach, user, assignment);
        await database.SaveChangesAsync();
        var controller = CreateController(database, new RecordingPasswordResetEmailService(), passwordHasher);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())], "test"))
            }
        };

        var result = await controller.LeaveCoach(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Null(user.CoachId);
        Assert.True(user.CanCoach);
        Assert.Equal(CoachingAssignmentStatus.Revoked, assignment.Status);
    }

    [Fact]
    public async Task RequestPasswordReset_WhenEmailIsUnknown_ReturnsGenericAcceptedResponseWithoutSendingEmail()
    {
        await using var database = CreateDatabase();
        var emailService = new RecordingPasswordResetEmailService();
        var controller = CreateController(database, emailService);

        var result = await controller.RequestPasswordReset(
            new RequestPasswordResetRequest("missing@example.com"),
            CancellationToken.None);

        var accepted = Assert.IsType<AcceptedResult>(result.Result);
        var response = Assert.IsType<PasswordResetRequestedResponse>(accepted.Value);
        Assert.Equal("If an account exists for that email address, a password reset link has been sent.", response.Message);
        Assert.Null(response.ResetUrl);
        Assert.Null(emailService.ResetUrl);
    }

    [Fact]
    public async Task RequestPasswordReset_WhenLocalLinkIsEnabled_ReturnsUsableLinkWithoutSendingEmail()
    {
        await using var database = CreateDatabase();
        var passwordHasher = new PasswordHashingService();
        var user = CreateUser(passwordHasher.Hash("OriginalPassword!"));
        database.PlatformUsers.Add(user);
        await database.SaveChangesAsync();
        var emailService = new RecordingPasswordResetEmailService();
        var controller = CreateController(database, emailService, passwordHasher, exposeResetLink: true);

        var requestResult = await controller.RequestPasswordReset(
            new RequestPasswordResetRequest(user.Email),
            CancellationToken.None);

        var accepted = Assert.IsType<AcceptedResult>(requestResult.Result);
        var response = Assert.IsType<PasswordResetRequestedResponse>(accepted.Value);
        Assert.Equal("If an account exists for that email address, use the one-hour reset link below.", response.Message);
        Assert.Null(emailService.ResetUrl);
        Assert.NotNull(user.PasswordResetTokenHash);

        var token = ResetTokenFrom(response.ResetUrl);
        var completeResult = await controller.CompletePasswordReset(
            new CompletePasswordResetRequest(token, "ReplacementPassword!"),
            CancellationToken.None);

        Assert.IsType<NoContentResult>(completeResult);
        Assert.True(passwordHasher.Verify("ReplacementPassword!", user.PasswordHash));
    }

    [Fact]
    public async Task CompletePasswordReset_WithCurrentToken_ChangesPasswordConsumesTokenAndRevokesSessions()
    {
        await using var database = CreateDatabase();
        var passwordHasher = new PasswordHashingService();
        var user = CreateUser(passwordHasher.Hash("OriginalPassword!"));
        database.PlatformUsers.Add(user);
        await database.SaveChangesAsync();
        var emailService = new RecordingPasswordResetEmailService();
        var controller = CreateController(database, emailService, passwordHasher);

        await controller.RequestPasswordReset(new RequestPasswordResetRequest(user.Email), CancellationToken.None);
        var token = ResetTokenFrom(emailService.ResetUrl);
        var result = await controller.CompletePasswordReset(
            new CompletePasswordResetRequest(token, "ReplacementPassword!"),
            CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.True(passwordHasher.Verify("ReplacementPassword!", user.PasswordHash));
        Assert.False(passwordHasher.Verify("OriginalPassword!", user.PasswordHash));
        Assert.Null(user.PasswordResetTokenHash);
        Assert.Null(user.PasswordResetExpiresAt);
        Assert.Equal(1, user.SessionVersion);

        var reusedResult = await controller.CompletePasswordReset(
            new CompletePasswordResetRequest(token, "AnotherReplacement!"),
            CancellationToken.None);
        Assert.Equal(400, Assert.IsAssignableFrom<ObjectResult>(reusedResult).StatusCode);
    }

    [Fact]
    public async Task CompletePasswordReset_WithExpiredToken_RejectsRequestWithoutChangingPassword()
    {
        await using var database = CreateDatabase();
        var passwordHasher = new PasswordHashingService();
        var originalHash = passwordHasher.Hash("OriginalPassword!");
        var user = CreateUser(originalHash);
        database.PlatformUsers.Add(user);
        await database.SaveChangesAsync();
        var emailService = new RecordingPasswordResetEmailService();
        var controller = CreateController(database, emailService, passwordHasher);

        await controller.RequestPasswordReset(new RequestPasswordResetRequest(user.Email), CancellationToken.None);
        var token = ResetTokenFrom(emailService.ResetUrl);
        user.PasswordResetExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
        await database.SaveChangesAsync();
        var result = await controller.CompletePasswordReset(
            new CompletePasswordResetRequest(token, "ReplacementPassword!"),
            CancellationToken.None);

        Assert.Equal(400, Assert.IsAssignableFrom<ObjectResult>(result).StatusCode);
        Assert.Equal(originalHash, user.PasswordHash);
        Assert.Equal(0, user.SessionVersion);
    }

    private static AuthenticationController CreateController(
        TrainingDbContext database,
        RecordingPasswordResetEmailService emailService,
        PasswordHashingService? passwordHasher = null,
        bool exposeResetLink = false)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Authentication:Jwt:SigningKey"] = new string('x', 64),
            ["Authentication:Jwt:Issuer"] = "tests",
            ["Authentication:Jwt:Audience"] = "tests",
            ["Authentication:ExposePasswordResetLink"] = exposeResetLink.ToString(),
            ["Client:PasswordResetUrl"] = "https://example.test/reset-password"
        }).Build();
        return new AuthenticationController(database, passwordHasher ?? new PasswordHashingService(), new JwtTokenService(configuration), emailService, configuration);
    }

    private static TrainingDbContext CreateDatabase()
    {
        var options = new DbContextOptionsBuilder<TrainingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TrainingDbContext(options);
    }

    private static PlatformUser CreateUser(string passwordHash) => new()
    {
        Email = "athlete@example.com",
        NormalizedEmail = "ATHLETE@EXAMPLE.COM",
        DisplayName = "Test Athlete",
        PasswordHash = passwordHash,
        Role = PlatformRole.Athlete
    };

    private static string ResetTokenFrom(string? resetUrl)
    {
        var query = new Uri(Assert.IsType<string>(resetUrl)).Query.TrimStart('?');
        return Uri.UnescapeDataString(query.Split('=', 2)[1]);
    }

    private sealed class RecordingPasswordResetEmailService : IPasswordResetEmailService
    {
        public string? ResetUrl { get; private set; }

        public Task SendAsync(string recipientEmail, string displayName, string resetUrl, CancellationToken cancellationToken)
        {
            ResetUrl = resetUrl;
            return Task.CompletedTask;
        }
    }
}