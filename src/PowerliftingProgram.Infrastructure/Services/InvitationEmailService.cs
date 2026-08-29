using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PowerliftingProgram.Infrastructure.Services;

public interface IInvitationEmailService
{
    Task<bool> SendAsync(string recipientEmail, string coachName, string registrationUrl, CancellationToken cancellationToken);
}

public sealed class ResendInvitationEmailService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<ResendInvitationEmailService> logger) : IInvitationEmailService
{
    public async Task<bool> SendAsync(string recipientEmail, string coachName, string registrationUrl, CancellationToken cancellationToken)
    {
        var apiKey = configuration["Email:Resend:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogInformation("Invitation email delivery is disabled; invitation created for {RecipientEmail}.", recipientEmail);
            return false;
        }

        var sender = configuration["Email:Resend:From"] ?? "Iron Forge <onboarding@resend.dev>";
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new
            {
                from = sender,
                to = new[] { recipientEmail },
                subject = "Your Coach has invited you to Iron Forge",
                html = IronForgeEmailTemplates.Invitation(coachName, registrationUrl)
            })
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        try
        {
            using var response = await httpClientFactory.CreateClient(nameof(ResendInvitationEmailService)).SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return true;
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogError(
                "Invitation email delivery failed with status {StatusCode} for {RecipientEmail}. Resend response: {ResponseBody}",
                response.StatusCode,
                recipientEmail,
                responseBody);
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Invitation email delivery failed for {RecipientEmail}.", recipientEmail);
        }

        return false;
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

        var sender = configuration["Email:Resend:From"] ?? "Iron Forge <onboarding@resend.dev>";
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new
            {
                from = sender,
                to = new[] { recipientEmail },
                subject = "Reset your Iron Forge password",
                html = IronForgeEmailTemplates.PasswordReset(displayName, resetUrl)
            })
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        try
        {
            using var response = await httpClientFactory.CreateClient(nameof(ResendPasswordResetEmailService)).SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogError(
                    "Password reset email delivery failed with status {StatusCode} for {RecipientEmail}. Resend response: {ResponseBody}",
                    response.StatusCode,
                    recipientEmail,
                    responseBody);
            }
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Password reset email delivery failed for {RecipientEmail}.", recipientEmail);
        }
    }
}