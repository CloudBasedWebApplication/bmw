param(
  [string]$BaseUrl = "http://localhost:3000",
  [switch]$SkipAi
)

$ErrorActionPreference = "Stop"

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Get-AppJson {
  param([string]$Path)
  Invoke-RestMethod -Method Get -Uri "$BaseUrl$Path" -TimeoutSec 20
}

Write-Host "Smoke target: $BaseUrl"

$homeResponse = Invoke-WebRequest -Method Get -Uri "$BaseUrl/" -TimeoutSec 20
Assert-Condition ($homeResponse.StatusCode -eq 200) "Home page did not return HTTP 200"
Assert-Condition ($homeResponse.Content -match "BMW") "Home page response did not contain expected BMW content"
Write-Host "OK home page"

$destinations = Get-AppJson "/api/destinations"
Assert-Condition (($destinations | Measure-Object).Count -gt 0) "Destinations endpoint returned no data"
Write-Host "OK gateway destinations"

$models = Get-AppJson "/api/configurator/models"
Assert-Condition (($models | Measure-Object).Count -gt 0) "Configurator models endpoint returned no data"
Write-Host "OK configurator data"

$products = Get-AppJson "/api/merch/products"
Assert-Condition (($products | Measure-Object).Count -gt 0) "Merch products endpoint returned no data"
Write-Host "OK merch data"

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cartItem = @{
  type = "merch"
  name = "Smoke Test Item"
  price = 1.23
  quantity = 1
  imageUrl = $null
  details = @{ source = "smoke-test" }
} | ConvertTo-Json -Depth 5

$created = Invoke-RestMethod `
  -Method Post `
  -Uri "$BaseUrl/api/cart/items" `
  -WebSession $session `
  -ContentType "application/json" `
  -Body $cartItem `
  -TimeoutSec 20

Assert-Condition ($created.name -eq "Smoke Test Item") "Cart add endpoint did not return the created item"

$cart = Invoke-RestMethod `
  -Method Get `
  -Uri "$BaseUrl/api/cart" `
  -WebSession $session `
  -TimeoutSec 20

$matchingItems = @($cart.items | Where-Object { $_.name -eq "Smoke Test Item" })
Assert-Condition ($matchingItems.Count -gt 0) "Fresh-session cart item was not persisted"
Write-Host "OK fresh-session cart persistence"

if (-not $SkipAi) {
  $aiBody = @{
    prompt = "I need a practical BMW for commuting and one matching accessory."
  } | ConvertTo-Json

  $ai = Invoke-RestMethod `
    -Method Post `
    -Uri "$BaseUrl/api/ai/recommend" `
    -ContentType "application/json" `
    -Body $aiBody `
    -TimeoutSec 60

  Assert-Condition ([string]::IsNullOrWhiteSpace($ai.text) -eq $false) "AI recommendation did not include text"
  Assert-Condition ($null -ne $ai.carLink -or (($ai.merchLinks | Measure-Object).Count -gt 0)) "AI recommendation did not include links"
  Write-Host "OK AI recommendation"
} else {
  Write-Host "SKIP AI recommendation"
}

Write-Host "Smoke test passed"
