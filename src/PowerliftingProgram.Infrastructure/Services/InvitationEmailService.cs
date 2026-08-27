using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PowerliftingProgram.Infrastructure.Services;

public interface IInvitationEmailService
{
    Task SendAsync(string recipientEmail, string coachName, string registrationUrl, CancellationToken cancellationToken);
}

public sealed class ResendInvitationEmailService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<ResendInvitationEmailService> logger) : IInvitationEmailService
{
    public async Task SendAsync(string recipientEmail, string coachName, string registrationUrl, CancellationToken cancellationToken)
    {
        var apiKey = configuration["Email:Resend:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogInformation("Invitation email delivery is disabled; invitation created for {RecipientEmail}.", recipientEmail);
            return;
        }

        var sender = configuration["Email:Resend:From"] ?? "Iron Forge <invites@example.com>";
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new
            {
                from = sender,
                to = new[] { recipientEmail },
                subject = "Your Coach has invited you to Iron Forge",
                html = $"<h1>Iron Forge</h1><p>{System.Net.WebUtility.HtmlEncode(coachName)} has invited you to train under their coaching roster.</p><p><a href=\"{System.Net.WebUtility.HtmlEncode(registrationUrl)}\">Create your athlete account</a></p><p>This invitation expires in 48 hours.</p>"
            })
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        var response = await httpClientFactory.CreateClient(nameof(ResendInvitationEmailService)).SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}

public interface IPasswordResetEmailService
{
    Task SendAsync(string recipientEmail, string displayName, string resetUrl, CancellationToken cancellationToken);
}

public sealed class ResendPasswordResetEmailService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<ResendPasswordResetEmailService> logger) : IPasswordResetEmailService
{
    public async Task SendAsync(string recipientEmail, string displayName, string resetUrl, CancellationToken cancellationToken)
    {
        var apiKey = configuration["Email:Resend:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogInformation("Password reset email delivery is disabled for {RecipientEmail}.", recipientEmail);
            return;
        }

        var sender = configuration["Email:Resend:From"] ?? "Iron Forge <invites@example.com>";
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new
            {
                from = sender,
                to = new[] { recipientEmail },
                subject = "Reset your Iron Forge password",
                html = $"<h1>Iron Forge</h1><p>Hello {System.Net.WebUtility.HtmlEncode(displayName)},</p><p><a href=\"{System.Net.WebUtility.HtmlEncode(resetUrl)}\">Reset your password</a></p><p>This link expires in one hour and can be used once. If you did not request it, no action is needed.</p>"
            })
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        try
        {
            using var response = await httpClientFactory.CreateClient(nameof(ResendPasswordResetEmailService)).SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Password reset email delivery failed with status {StatusCode} for {RecipientEmail}.", response.StatusCode, recipientEmail);
            }
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Password reset email delivery failed for {RecipientEmail}.", recipientEmail);
        }
    }
}