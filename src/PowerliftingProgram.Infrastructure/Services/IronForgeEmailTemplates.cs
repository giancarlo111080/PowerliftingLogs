using System.Net;

namespace PowerliftingProgram.Infrastructure.Services;

internal static class IronForgeEmailTemplates
{
    public static string Invitation(string coachName, string registrationUrl) => Layout(
        eyebrow: "COACH INVITATION",
        heading: "Your next training block starts here.",
        introduction: $"{WebUtility.HtmlEncode(coachName)} invited you to join their coaching roster on Iron Forge.",
        actionLabel: "Accept invitation",
        actionUrl: registrationUrl,
        expiration: "This private invitation expires in 48 hours.",
        footer: "If you were not expecting this invitation, you can safely ignore this email.");

    public static string PasswordReset(string displayName, string resetUrl) => Layout(
        eyebrow: "ACCOUNT RECOVERY",
        heading: "Reset your Iron Forge password.",
        introduction: $"Hello {WebUtility.HtmlEncode(displayName)}. Use the secure link below to choose a new password.",
        actionLabel: "Reset password",
        actionUrl: resetUrl,
        expiration: "This one-time link expires in one hour.",
        footer: "If you did not request a password reset, no action is needed and your password remains unchanged.");

    private static string Layout(string eyebrow, string heading, string introduction, string actionLabel, string actionUrl, string expiration, string footer)
    {
        var encodedUrl = WebUtility.HtmlEncode(actionUrl);
        return $$"""
            <!doctype html>
            <html lang="en">
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Iron Forge</title></head>
            <body style="margin:0;background:#101418;color:#f4f4ed;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#101418;padding:32px 12px;">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#17212b;border:1px solid #52607a;">
                    <tr><td style="padding:28px 32px 20px;border-top:6px solid #ff3b45;">
                      <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:28px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#f4f4ed;">IRON <span style="color:#ccff00;">FORGE</span></div>
                      <div style="margin-top:22px;font-family:monospace;font-size:11px;letter-spacing:1px;color:#abb5c8;">{{eyebrow}}</div>
                      <h1 style="margin:10px 0 14px;font-family:'Arial Narrow',Arial,sans-serif;font-size:34px;line-height:1.05;text-transform:uppercase;color:#ffffff;">{{heading}}</h1>
                      <p style="margin:0;font-size:16px;line-height:1.6;color:#d7dce7;">{{introduction}}</p>
                    </td></tr>
                    <tr><td style="padding:8px 32px 30px;">
                      <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#ff3b45;">
                        <a href="{{encodedUrl}}" style="display:inline-block;padding:14px 22px;font-family:'Arial Narrow',Arial,sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;text-decoration:none;color:#ffffff;">{{actionLabel}}</a>
                      </td></tr></table>
                      <p style="margin:18px 0 0;font-family:monospace;font-size:12px;line-height:1.5;color:#ccff00;">{{expiration}}</p>
                      <p style="margin:24px 0 8px;font-size:12px;line-height:1.5;color:#abb5c8;">If the button does not work, open this address:</p>
                      <p style="margin:0;word-break:break-all;font-family:monospace;font-size:11px;line-height:1.5;color:#d7dce7;">{{encodedUrl}}</p>
                    </td></tr>
                    <tr><td style="padding:20px 32px;border-top:1px solid #52607a;font-size:12px;line-height:1.5;color:#8996ac;">{{footer}}<br><br>Iron Forge provides training guidance and does not replace medical advice.</td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
    }
}