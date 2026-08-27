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
        Assert.Null(emailService.ResetUrl);
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
        PasswordHashingService? passwordHasher = null)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Authentication:Jwt:SigningKey"] = new string('x', 64),
            ["Authentication:Jwt:Issuer"] = "tests",
            ["Authentication:Jwt:Audience"] = "tests",
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