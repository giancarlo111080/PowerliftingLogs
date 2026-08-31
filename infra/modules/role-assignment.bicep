@description('Principal ID to assign the role to')
param principalId string

@description('Role Definition ID (GUID)')
param roleDefinitionId string

@description('ACR Resource ID')
param acrResourceId string

@description('Principal Type')
param principalType string = 'ServicePrincipal'

// Extract ACR resource information
var acrResourceParts = split(acrResourceId, '/')
var acrName = acrResourceParts[8]

// Get reference to existing ACR
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

// Assign role at ACR scope
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acrResourceId, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: principalType
  }
}

output roleAssignmentId string = roleAssignment.id
