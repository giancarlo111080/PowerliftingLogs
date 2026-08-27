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
            logger.LogInformation("Invitation email for {RecipientEmail}: {RegistrationUrl}", recipientEmail, registrationUrl);
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