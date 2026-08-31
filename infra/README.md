# PowerliftingLogs Azure Infrastructure

This directory contains the Bicep infrastructure as code for deploying PowerliftingLogs to Azure Container Apps.

## Architecture

The infrastructure deploys the following Azure resources:

- **Azure Container Registry (ACR)**: Stores the API container image
- **Log Analytics Workspace**: Centralized logging for Container Apps
- **Container Apps Environment**: Managed environment for running containers
- **Container App**: Runs the ASP.NET Core 8 API with:
  - External HTTPS ingress on port 8080
  - Auto-scaling (min 0, max 1 replicas)
  - Resource limits: 0.25 CPU, 0.5Gi memory
  - Health probes: `/health/live` and `/health/ready`
  - System-assigned managed identity for ACR access
  - CORS configured for GitHub Pages frontend

## Prerequisites

1. **Azure Developer CLI (azd)**: [Install azd](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
2. **Azure CLI**: [Install Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
3. **Docker**: For building container images
4. **.NET 8 SDK**: For local development

### External Services Required

- **PostgreSQL Database**: External managed PostgreSQL (Neon free tier or Azure Database for PostgreSQL)
- **Resend Account**: For email sending with verified sender domain
- **GitHub Pages**: Frontend deployment (not provisioned by this infrastructure)

## Initial Setup

### 1. Initialize Azure Developer CLI

```bash
# Initialize in your project directory
azd init

# When prompted, use the existing azure.yaml configuration
```

### 2. Create Environment Configuration

```bash
# Create a new environment (e.g., "dev", "prod")
azd env new <environment-name>

# This creates .azure/<environment-name>/.env
```

### 3. Configure Environment Variables

Edit `.azure/<environment-name>/.env` and set the following required variables:

```bash
# Azure Configuration
AZURE_ENV_NAME=<environment-name>
AZURE_LOCATION=eastus2
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
AZURE_PRINCIPAL_ID=<your-azure-ad-user-id>

# Frontend Origin (Required)
FRONTEND_ORIGIN=https://<your-username>.github.io/<your-repo>

# Database Connection (Required)
DATABASE_CONNECTION_STRING="Host=<db-host>;Port=5432;Database=powerlifting;Username=<user>;Password=<password>;SslMode=Require"

# JWT Signing Key (Required - Generate with: openssl rand -base64 64)
JWT_SIGNING_KEY=<base64-encoded-key-min-64-bytes>

# Resend Configuration (Required)
RESEND_API_KEY=re_<your-resend-api-key>
VERIFIED_SENDER_EMAIL=noreply@yourdomain.com
```

#### Get Your Azure Principal ID

```bash
# Get your current user's principal ID
az ad signed-in-user show --query id -o tsv
```

#### Generate JWT Signing Key

```bash
# Generate a secure 64-byte key (base64 encoded)
openssl rand -base64 64 | tr -d '\n'
```

### 4. Login to Azure

```bash
azd auth login
az login
```

## Deployment

### Full Deployment (Infrastructure + Application)

```bash
# Provision infrastructure and deploy application
azd up
```

This command will:
1. Create the Azure resources
2. Build the Docker image
3. Push to Azure Container Registry
4. Deploy the container to Azure Container Apps
5. Run database migrations on startup

### Infrastructure Only

```bash
# Provision or update infrastructure
azd provision
```

### Application Only

```bash
# Build and deploy application (infrastructure must exist)
azd deploy
```

## Configuration Details

### Container App Settings

The API container is configured with:

- **Environment**: Production
- **Port**: 8080 (HTTP inside container, HTTPS at ingress)
- **Scaling**: 0-1 replicas (scale to zero when idle)
- **Resources**: 0.25 CPU cores, 0.5 GiB memory
- **Health Probes**:
  - Liveness: `/health/live` (every 30s)
  - Readiness: `/health/ready` (every 10s)
  - Startup: `/health/ready` (every 5s, max 150s)

### Security

- Database connection string stored as Container App secret
- JWT signing key stored as Container App secret
- Resend API key stored as Container App secret
- System-assigned managed identity for ACR access
- CORS restricted to configured frontend origin
- Password reset links disabled in production
- Sample data seeding disabled

### Database Migrations

Migrations run automatically on container startup:
- `Database__ApplyMigrationsOnStartup=true`
- `Database__SeedSampleDataOnStartup=false`

## Accessing Resources

### Get API URL

```bash
azd env get-values | grep API_URL
```

Or from Azure Portal:
1. Navigate to the Container App
2. Copy the "Application Url" from the Overview page

### View Logs

```bash
# Stream container logs
az containerapp logs show \
  --name $(azd env get-values | grep AZURE_CONTAINER_APP_NAME | cut -d'=' -f2) \
  --resource-group $(azd env get-values | grep AZURE_RESOURCE_GROUP | cut -d'=' -f2) \
  --follow
```

### Access Container Registry

```bash
# Login to ACR
az acr login --name $(azd env get-values | grep AZURE_CONTAINER_REGISTRY_NAME | cut -d'=' -f2)
```

## Updating Configuration

### Update Environment Variables

Edit `.azure/<environment-name>/.env` and re-run:

```bash
azd up
```

### Update Secrets

Secrets are automatically updated during deployment. To manually update:

```bash
# Update via azd
azd env set <VARIABLE_NAME> <new-value>
azd deploy
```

## Monitoring

### Application Insights

Logs are sent to the Log Analytics workspace. Query logs in Azure Portal:

1. Navigate to the Container Apps Environment
2. Click "Logs" in the left menu
3. Run queries:

```kusto
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == '<your-app-name>'
| order by TimeGenerated desc
| take 100
```

### Health Endpoints

- **Liveness**: `https://<your-app>.azurecontainerapps.io/health/live`
- **Readiness**: `https://<your-app>.azurecontainerapps.io/health/ready`

## Troubleshooting

### Container Won't Start

1. Check container logs:
   ```bash
   az containerapp logs show --name <app-name> --resource-group <rg-name> --follow
   ```

2. Verify secrets are set correctly:
   ```bash
   az containerapp secret list --name <app-name> --resource-group <rg-name>
   ```

3. Check health probe responses:
   ```bash
   curl https://<your-app>.azurecontainerapps.io/health/ready
   ```

### Database Connection Issues

- Verify connection string format and credentials
- Ensure firewall rules allow Azure Container Apps outbound connections
- Check that `SslMode=Require` is set for secure connections
- Test connection string locally first

### Authentication Issues

- Ensure JWT signing key is at least 64 bytes when base64 decoded
- Verify frontend origin matches exactly (including https://)
- Check CORS configuration in Container App

### Image Pull Failures

- Verify ACR role assignment for Container App managed identity:
  ```bash
  az role assignment list --assignee <managed-identity-principal-id> --scope <acr-resource-id>
  ```

## Cost Optimization

- **Container App**: Scales to zero when idle (no replica charges)
- **ACR**: Basic tier ($0.167/day)
- **Log Analytics**: Pay-per-GB ingestion
- **Container Apps Environment**: Free

**Estimated Monthly Cost**: ~$5-10 USD (with scale-to-zero)

## Clean Up

### Remove All Resources

```bash
# Delete all Azure resources for the environment
azd down
```

### Remove Environment Configuration

```bash
# Delete environment configuration
azd env remove <environment-name>
```

## CI/CD Integration

### GitHub Actions

Example workflow for automated deployment:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install azd
        uses: Azure/setup-azd@v1
        
      - name: Azure Login
        run: |
          azd auth login --client-id ${{ secrets.AZURE_CLIENT_ID }} \
            --client-secret ${{ secrets.AZURE_CLIENT_SECRET }} \
            --tenant-id ${{ secrets.AZURE_TENANT_ID }}
      
      - name: Deploy
        run: azd up --no-prompt
        env:
          AZURE_ENV_NAME: ${{ secrets.AZURE_ENV_NAME }}
          AZURE_LOCATION: ${{ secrets.AZURE_LOCATION }}
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

## Azure Verified Modules (AVM)

This infrastructure uses Azure Verified Modules from the Bicep Public Registry:

- `avm/res/container-registry/registry:0.6.0`
- `avm/res/operational-insights/workspace:0.9.1`
- `avm/res/app/managed-environment:0.8.2`
- `avm/res/app/container-app:0.12.0`

These modules follow Microsoft best practices and are maintained by the Azure team.

## Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure Developer CLI Documentation](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
- [Azure Verified Modules](https://aka.ms/AVM)
- [Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
