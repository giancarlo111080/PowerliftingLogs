# Production Notes

- Keep `Authentication__Jwt__SigningKey` in secure secret storage, with a strong value and regular rotation.
- Keep `ConnectionStrings__TrainingDatabase` in secure secret storage.
- Keep `Authentication__ExposePasswordResetLink=false` in public environments.
- Set `Email__Resend__ApiKey` and verified `Email__Resend__From` before sending invites.
- Set `Client__RegistrationUrl` and `Client__PasswordResetUrl` to deployed client routes.
- Terminate TLS before the API and allow only trusted CORS origins.
- Use backups, health checks, and managed secret injection.
- Keep unique `SyncCommands.CommandId` index intact for offline replay protection.
- Store Instagram links only with consent and per platform/privacy policy.
