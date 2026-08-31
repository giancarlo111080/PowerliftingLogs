targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment for resource naming and tagging')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('ID of the principal (user/service principal) to assign ACR push/pull role')
param principalId string = ''

@description('Type of the principal (User, ServicePrincipal, or Group)')
@allowed([
  'User'
  'ServicePrincipal'
  'Group'
])
param principalType string = 'User'

// Required Parameters - Frontend Configuration
@minLength(1)
@description('Frontend origin for CORS, with no path or trailing slash. Example: https://user.github.io')
param frontendOrigin string

@minLength(1)
@description('Full frontend base URL used in email links. Example: https://user.github.io/PowerliftingLogs')
param frontendBaseUrl string

@secure()
@minLength(1)
@description('PostgreSQL connection string. Example: Host=xxx.postgres.database.azure.com;Port=5432;Database=powerlifting;Username=xxx;Password=xxx;SslMode=Require')
param databaseConnectionString string

@secure()
@minLength(64)
@description('JWT signing key for authentication. Must be at least 64 bytes (base64 encoded).')
param jwtSigningKey string

@secure()
@minLength(1)
@description('Resend API key for email sending')
param resendApiKey string

@minLength(1)
@description('Verified sender email address for Resend (cannot use github.io domain)')
param verifiedSenderEmail string

// Optional Parameters
@description('Enable Container Registry admin user')
param enableAcrAdminUser bool = false

@description('Log Analytics workspace retention in days')
param logAnalyticsRetentionDays int = 30

@description('Fully qualified container image. azd replaces the bootstrap image during deployment.')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Tags to apply to all resources')
param tags object = {
  environment: environmentName
  application: 'powerlifting-logs'
  managedBy: 'azd'
}

// Variables
var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var resourceGroupName = '${abbrs.resourcesResourceGroups}${environmentName}'

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// Azure Container Registry using AVM
module acr 'br/public:avm/res/container-registry/registry:0.6.0' = {
  scope: rg
  name: 'acr-deployment'
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: tags
    acrSku: 'Basic'
    acrAdminUserEnabled: enableAcrAdminUser
    publicNetworkAccess: 'Enabled'
    anonymousPullEnabled: false
    dataEndpointEnabled: false
    exportPolicyStatus: 'enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: 'Disabled'
    roleAssignments: principalId != '' ? [
      {
        principalId: principalId
        principalType: principalType
        roleDefinitionIdOrName: 'AcrPull'
      }
      {
        principalId: principalId
        principalType: principalType
        roleDefinitionIdOrName: 'AcrPush'
      }
    ] : []
  }
}

// Log Analytics Workspace using AVM
module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.9.1' = {
  scope: rg
  name: 'log-analytics-deployment'
  params: {
    name: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    location: location
    tags: tags
    skuName: 'PerGB2018'
    dataRetention: logAnalyticsRetentionDays
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Container Apps Environment using AVM
module containerAppsEnvironment 'br/public:avm/res/app/managed-environment:0.8.2' = {
  scope: rg
  name: 'container-apps-env-deployment'
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    tags: tags
    logAnalyticsWorkspaceResourceId: logAnalytics.outputs.resourceId
    zoneRedundant: false
    infrastructureSubnetId: ''
    internal: false
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// Container App for API using AVM
module containerApp 'br/public:avm/res/app/container-app:0.12.0' = {
  scope: rg
  name: 'container-app-deployment'
  params: {
    name: '${abbrs.appContainerApps}api-${resourceToken}'
    location: location
    tags: tags
    environmentResourceId: containerAppsEnvironment.outputs.resourceId
    managedIdentities: {
      systemAssigned: true
    }
    registries: [
      {
        server: acr.outputs.loginServer
        identity: 'system'
      }
    ]
    containers: [
      {
        name: 'api'
        image: containerImage
        resources: {
          cpu: json('0.25')
          memory: '0.5Gi'
        }
        probes: [
          {
            type: 'Liveness'
            httpGet: {
              path: '/health/live'
              port: 8080
              scheme: 'HTTP'
            }
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          }
          {
            type: 'Readiness'
            httpGet: {
              path: '/health/ready'
              port: 8080
              scheme: 'HTTP'
            }
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          }
          {
            type: 'Startup'
            httpGet: {
              path: '/health/ready'
              port: 8080
              scheme: 'HTTP'
            }
            initialDelaySeconds: 1
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 10
          }
        ]
        env: [
          {
            name: 'ASPNETCORE_ENVIRONMENT'
            value: 'Production'
          }
          {
            name: 'ASPNETCORE_URLS'
            value: 'http://+:8080'
          }
          {
            name: 'ConnectionStrings__TrainingDatabase'
            secretRef: 'database-connection-string'
          }
          {
            name: 'Authentication__Jwt__SigningKey'
            secretRef: 'jwt-signing-key'
          }
          {
            name: 'Email__Resend__ApiKey'
            secretRef: 'resend-api-key'
          }
          {
            name: 'Email__Resend__From'
            value: 'Iron Forge <${verifiedSenderEmail}>'
          }
          {
            name: 'Cors__AllowedOrigins__0'
            value: frontendOrigin
          }
          {
            name: 'Client__RegistrationUrl'
            value: '${frontendBaseUrl}/register'
          }
          {
            name: 'Client__InvitationUrl'
            value: '${frontendBaseUrl}/invitation'
          }
          {
            name: 'Client__PasswordResetUrl'
            value: '${frontendBaseUrl}/reset-password'
          }
          {
            name: 'Database__Provider'
            value: 'Postgres'
          }
          {
            name: 'Database__ApplyMigrationsOnStartup'
            value: 'true'
          }
          {
            name: 'Database__SeedSampleDataOnStartup'
            value: 'false'
          }
          {
            name: 'Authentication__ExposePasswordResetLink'
            value: 'false'
          }
        ]
      }
    ]
    secrets: {
      secureList: [
        {
          name: 'database-connection-string'
          value: databaseConnectionString
        }
        {
          name: 'jwt-signing-key'
          value: jwtSigningKey
        }
        {
          name: 'resend-api-key'
          value: resendApiKey
        }
      ]
    }
    scaleMinReplicas: 0
    scaleMaxReplicas: 1
    ingressExternal: true
    ingressTargetPort: 8080
    ingressTransport: 'auto'
    ingressAllowInsecure: false
    corsPolicy: {
      allowedOrigins: [
        frontendOrigin
      ]
      allowedMethods: [
        'GET'
        'POST'
        'PUT'
        'DELETE'
        'PATCH'
        'OPTIONS'
      ]
      allowedHeaders: [
        '*'
      ]
      exposeHeaders: [
        '*'
      ]
      maxAge: 3600
      allowCredentials: true
    }
  }
}

// Assign AcrPull role to Container App managed identity
module acrPullRoleAssignment './modules/role-assignment.bicep' = {
  scope: rg
  name: 'acr-pull-role-assignment'
  params: {
    principalId: containerApp.outputs.systemAssignedMIPrincipalId
    roleDefinitionId: '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
    acrResourceId: acr.outputs.resourceId
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = acr.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = acr.outputs.name
output AZURE_CONTAINER_APP_NAME string = containerApp.outputs.name
output AZURE_CONTAINER_APP_FQDN string = containerApp.outputs.fqdn
output API_URL string = 'https://${containerApp.outputs.fqdn}'
output LOG_ANALYTICS_WORKSPACE_ID string = logAnalytics.outputs.resourceId
output CONTAINER_APP_IDENTITY_PRINCIPAL_ID string = containerApp.outputs.systemAssignedMIPrincipalId
