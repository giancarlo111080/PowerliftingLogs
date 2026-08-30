# Azure Deployment (Step-by-Step)

This guide deploys:
- API: Azure App Service (.NET 8)
- Database: Azure Database for PostgreSQL Flexible Server
- Web client: either free GitHub Pages (`github.io`) or Azure Static Web Apps

## 1) Prerequisites

1. Azure subscription
2. Azure CLI installed (`az --version`)
3. .NET 8 SDK and Node.js 20+
4. GitHub repository with this project

## 2) Create Azure Resource Group

1. Sign in:
   - `az login`
2. Create resource group:
   - `az group create --name powerliftinglogs-rg --location eastus`

## 3) Create PostgreSQL Flexible Server

1. Create server:
   - `az postgres flexible-server create --resource-group powerliftinglogs-rg --name powerliftinglogs-pg --location eastus --admin-user pgadminuser --admin-password <strong-password> --sku-name Standard_B1ms --tier Burstable`
2. Create database:
   - `az postgres flexible-server db create --resource-group powerliftinglogs-rg --server-name powerliftinglogs-pg --database-name powerlifting_program`
3. Allow Azure services access or configure specific firewall rules for App Service.

## 4) Create App Service Plan and Web App for API

1. Create Linux App Service plan:
   - `az appservice plan create --name powerliftinglogs-plan --resource-group powerliftinglogs-rg --sku B1 --is-linux`
2. Create .NET web app:
   - `az webapp create --resource-group powerliftinglogs-rg --plan powerliftinglogs-plan --name powerliftinglogs-api --runtime "DOTNETCORE|8.0"`

## 5) Configure API App Settings

Set required settings:

1. PostgreSQL connection string (`ConnectionStrings__TrainingDatabase`)
2. JWT signing key (`Authentication__Jwt__SigningKey`)
3. Environment (`ASPNETCORE_ENVIRONMENT=Production`)
4. CORS allowed origins for your client domain
5. Optional email settings:
   - `Email__Resend__ApiKey`
   - `Email__Resend__From`
6. Client callback URLs:
   - `Client__RegistrationUrl`
   - `Client__PasswordResetUrl`
7. Keep password reset link exposure disabled:
   - `Authentication__ExposePasswordResetLink=false`

Example command pattern:

```bash
az webapp config appsettings set \
  --resource-group powerliftinglogs-rg \
  --name powerliftinglogs-api \
  --settings KEY1=value1 KEY2=value2
```

## 6) Deploy API

1. Publish API:
   - `dotnet publish src/PowerliftingProgram.Api -c Release -o ./publish`
2. Zip package from `publish` output.
3. Deploy zip:
   - `az webapp deploy --resource-group powerliftinglogs-rg --name powerliftinglogs-api --src-path ./publish.zip --type zip`

## 7) Apply EF Core Migrations to Azure Database

Run migrations using production connection settings before first production use.

Recommended approach:
1. Set production connection in environment variables.
2. Run `dotnet ef database update` against Azure PostgreSQL from a secure environment.

## 8) Deploy Client

### Option A (Free domain on GitHub Pages)

1. Use existing Pages workflow.
2. Set `EXPO_PUBLIC_API_URL=https://powerliftinglogs-api.azurewebsites.net` in GitHub Actions variables.
3. Publish at:
   - `https://<your-github-username>.github.io/PowerliftingLogs/`

### Option B (Azure Static Web Apps)

1. Create Static Web App in Azure.
2. Connect to the GitHub repository.
3. Set build command/output for Expo web export.
4. Add `EXPO_PUBLIC_API_URL` pointing to App Service API.

## 9) Post-Deployment Validation

1. Open API docs endpoint and verify response.
2. Verify login/register flow.
3. Verify invite flow.
4. Verify training log operations.
5. Confirm HTTPS and CORS behavior.
6. Confirm database writes and reads.

## 10) Operations Checklist

1. Enable monitoring and application logs.
2. Configure PostgreSQL backups.
3. Rotate JWT and email secrets regularly.
4. Restrict CORS to trusted domains only.
5. Keep all secrets in Azure secure configuration (Key Vault/App Settings), never in client code.
