# Free GitHub Pages Deployment (`github.io`)

GitHub Pages can host the web client for free when the repository is public.

- Free default domain format:
  - `https://<your-github-username>.github.io/PowerliftingLogs/`

## Publish Steps

1. Create a new **public** GitHub repository (for example `PowerliftingLogs`).
2. In repository root, verify remotes:
   - `git remote -v`
3. If needed, connect local repo to GitHub:

```powershell
git branch -M main
git remote add origin https://github.com/<your-github-username>/PowerliftingLogs.git
```

4. Commit and push:

```powershell
git add .
git commit -m "Deploy to GitHub Pages"
git push -u origin main
```

5. In GitHub: **Settings** -> **Pages** -> set **Source** to **GitHub Actions**.
6. Open **Actions**, run/verify **Deploy static demo to GitHub Pages**.
7. Open published site at:
   - `https://<your-github-username>.github.io/PowerliftingLogs/`

## Demo Mode Behavior

In static mode, programs/logs/settings are saved in each browser's local storage.
No ASP.NET Core runtime or PostgreSQL is hosted by GitHub Pages.

## Optional Live API Connection

The workflow behavior:
- No `EXPO_PUBLIC_API_URL`: deploys browser-local static demo.
- With `EXPO_PUBLIC_API_URL`: deploys client targeting your hosted API.

To set it:
1. GitHub **Settings** -> **Secrets and variables** -> **Actions** -> **Variables**
2. Add variable `EXPO_PUBLIC_API_URL`
3. Set value to your public API URL
4. Push to `main` or rerun the workflow
