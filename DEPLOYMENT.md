# Quick Start Deployment Guide

## Prerequisites Check

Before deploying, ensure you have:

1. **Azure Developer CLI (azd)**
   ```powershell
   winget install Microsoft.Azd
   # or
   powershell -ex AllSigned -c "Invoke-RestMethod 'https://aka.ms/install-azd.ps1' | Invoke-Expression"
   ```

2. **Docker Desktop** (for building images)
   - Download from: https://www.docker.com/products/docker-desktop

3. **External Services**
   - PostgreSQL database (Neon free tier: https://neon.tech)
   - Resend account (https://resend.com)
   - GitHub Pages site URL

## Quick Deployment Steps

### 1. Generate JWT Signing Key

```powershell
# Generate a secure 64-byte key
$bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64)
$key = [Convert]::ToBase64String($bytes)
Write-Output $key
```

### 2. Initialize Azure Developer CLI

```powershell
# Login to Azure
azd auth login

# Initialize environment (first time only)
azd env new prod

# Set required variables
azd env set AZURE_LOCATION eastus2
azd env set FRONTEND_ORIGIN "https://YOUR_USERNAME.github.io"
azd env set FRONTEND_BASE_URL "https://YOUR_USERNAME.github.io/YOUR_REPO"
azd env set VERIFIED_SENDER_EMAIL "noreply@yourdomain.com"
```

### 3. Configure Secrets

```powershell
# Set database connection string
azd env set DATABASE_CONNECTION_STRING "Host=YOUR_HOST.neon.tech;Port=5432;Database=powerlifting;Username=YOUR_USER;Password=YOUR_PASSWORD;SslMode=Require"

# Set JWT signing key (from step 1)
azd env set JWT_SIGNING_KEY "YOUR_GENERATED_KEY"

# Set Resend API key
azd env set RESEND_API_KEY "re_YOUR_KEY"
```

### 4. Get Your Azure Principal ID

```powershell
az login
az ad signed-in-user show --query id -o tsv
azd env set AZURE_PRINCIPAL_ID "YOUR_PRINCIPAL_ID"
```

### 5. Deploy Everything

```powershell
# Deploy infrastructure and application
azd up

# Follow prompts to select subscription and confirm
```

### 6. Get API URL

```powershell
# View all output values
azd env get-values

# Get just the API URL
azd env get-values | Select-String "API_URL"
```

### 7. Connect GitHub Pages

In the GitHub repository, open **Settings > Secrets and variables > Actions > Variables** and set:

```text
EXPO_PUBLIC_API_URL=https://<your-container-app-fqdn>
```

Use the exact `API_URL` emitted by `azd up`, then rerun the **Deploy static demo to GitHub Pages** workflow. The Pages build will switch from browser-local demo mode to the production API.

The API CORS value `FRONTEND_ORIGIN` must be only the origin, without a trailing slash or route. For a project Pages site use:

```text
https://YOUR_USERNAME.github.io
```

The API-generated invitation and reset links can include the repository path. If the site is hosted under `/PowerliftingLogs`, set `FRONTEND_ORIGIN` to the full site URL during provisioning:

```text
https://YOUR_USERNAME.github.io/PowerliftingLogs
```

Then add the origin-only URL as an additional `Cors__AllowedOrigins` setting if needed. A custom domain avoids this path/origin distinction and is recommended before inviting real users.

## Environment Variables Reference

Create `.azure/ENVIRONMENT_NAME/.env` with:

```bash
# Required
AZURE_ENV_NAME=prod
AZURE_LOCATION=eastus2
AZURE_SUBSCRIPTION_ID=<from az account show>
AZURE_PRINCIPAL_ID=<from az ad signed-in-user show>

FRONTEND_ORIGIN=https://your-username.github.io
FRONTEND_BASE_URL=https://your-username.github.io/your-repo
The API CORS value `FRONTEND_ORIGIN` must be only the origin, without a trailing slash or route. For a project Pages site use:
The API-generated invitation and reset links need the repository path. Set `FRONTEND_BASE_URL` to the full site URL:
A custom domain avoids this path/origin distinction and is recommended before inviting real users.
DATABASE_CONNECTION_STRING="Host=...;Port=5432;Database=...;Username=...;Password=...;SslMode=Require"
JWT_SIGNING_KEY=<64+ byte base64 key>
RESEND_API_KEY=re_...
VERIFIED_SENDER_EMAIL=noreply@yourdomain.com
```

## Verify Deployment

1. **Check Container App Status**
   ```powershell
   az containerapp show --name $(azd env get-values | Select-String "AZURE_CONTAINER_APP_NAME" | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') }) --resource-group $(azd env get-values | Select-String "AZURE_RESOURCE_GROUP" | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') }) --query "properties.runningStatus"
   ```

2. **Test Health Endpoints**
   ```powershell
   $apiUrl = (azd env get-values | Select-String "API_URL" | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') })
   Invoke-WebRequest "$apiUrl/health/live"
   Invoke-WebRequest "$apiUrl/health/ready"
   ```

3. **View Logs**
   ```powershell
   az containerapp logs show --name $(azd env get-values | Select-String "AZURE_CONTAINER_APP_NAME" | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') }) --resource-group $(azd env get-values | Select-String "AZURE_RESOURCE_GROUP" | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') }) --follow
   ```

## Update Application

```powershell
# Make code changes, then:
azd deploy
```

## Update Infrastructure

```powershell
# Modify infra/main.bicep, then:
azd provision
```

## Troubleshooting

### Container fails to start
Check logs and environment variables:
```powershell
# Get app name
$appName = (azd env get-values | Select-String "AZURE_CONTAINER_APP_NAME" | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') })
$rgName = (azd env get-values | Select-String "AZURE_RESOURCE_GROUP" | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') })

# View logs
az containerapp logs show --name $appName --resource-group $rgName --follow

# Check environment variables
az containerapp show --name $appName --resource-group $rgName --query "properties.template.containers[0].env"
```

### Database connection fails
1. Verify connection string format
2. Ensure database allows connections from Azure
3. Test connection string locally first

### CORS errors
Verify FRONTEND_ORIGIN matches exactly (including https://)

## Cost Management

Monitor costs in Azure Portal:
1. Navigate to Cost Management
2. Filter by resource group name (starts with "rg-")

To reduce costs:
- Container App scales to zero automatically when idle
- Azure Container Registry Basic and Log Analytics can still incur charges even while the API is scaled to zero.
- External PostgreSQL and Resend are governed by their own free-plan limits.

## Clean Up

```powershell
# Delete all resources
azd down

# Or manually delete resource group
az group delete --name rg-YOUR_ENV_NAME --yes
```
