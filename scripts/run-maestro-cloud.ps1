<#
.SYNOPSIS
  Runs the e2e/ Maestro workspace on Maestro Cloud (iPhone 11 / iOS 18.2).

.DESCRIPTION
  Requires an existing iOS Simulator build (.app folder, or the .tar.gz that
  EAS produces). Credentials come only from environment variables of the
  current session and are never printed:
    MAESTRO_CLOUD_API_KEY  Maestro Cloud API key (optional after 'maestro login')
    MAESTRO_PROJECT_ID     Maestro Cloud project id
    E2E_EMAIL, E2E_PASSWORD  dedicated E2E account (not needed with -SmokeOnly)
  Exit code: 0 when every flow passed; non-zero otherwise (Maestro's code).
  Devices: `maestro list-cloud-devices` (iPhone-11 supports iOS-18-2).

.EXAMPLE
  ./scripts/run-maestro-cloud.ps1 -AppPath artifacts/e2e/build.tar.gz
  ./scripts/run-maestro-cloud.ps1 -AppPath artifacts/e2e/app/AthleteCoachE2E.app -SmokeOnly
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$AppPath,
  [string]$Workspace = "e2e",
  [string]$DeviceModel = "iPhone-11",
  [string]$DeviceOs = "iOS-18-2",
  [string]$ReportDir = "artifacts/e2e",
  [switch]$SmokeOnly,
  # Run only flows with these tags (e.g. "coach"); credentials are still needed.
  [string[]]$IncludeTags
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Fail([string]$message) { Write-Host "ERRO: $message" -ForegroundColor Red; exit 2 }

if (-not (Get-Command maestro -ErrorAction SilentlyContinue)) { Fail "Maestro CLI nao encontrado no PATH (veja e2e/README.md)." }
# Auth: MAESTRO_CLOUD_API_KEY in the session, or a local `maestro login` session
# (token stored by the CLI in ~/.mobiledev; never read or printed here).
$loginToken = Join-Path (Join-Path $env:USERPROFILE ".mobiledev") "authtoken"
if (-not $env:MAESTRO_CLOUD_API_KEY -and -not (Test-Path $loginToken)) { Fail "Defina MAESTRO_CLOUD_API_KEY nesta sessao ou rode 'maestro login'." }
if (-not $env:MAESTRO_PROJECT_ID) { Fail "Defina MAESTRO_PROJECT_ID nesta sessao." }
if (-not $SmokeOnly -and (-not $env:E2E_EMAIL -or -not $env:E2E_PASSWORD)) { Fail "Defina E2E_EMAIL e E2E_PASSWORD (ou use -SmokeOnly)." }
if (-not (Test-Path $AppPath)) { Fail "Build nao encontrado: $AppPath" }
if (-not (Test-Path (Join-Path $Workspace "config.yaml"))) { Fail "Workspace Maestro invalido: $Workspace" }

New-Item -ItemType Directory -Force $ReportDir | Out-Null

# EAS simulator builds are .tar.gz archives containing the .app folder.
$resolvedApp = (Resolve-Path $AppPath).Path
if ($resolvedApp -match '\.(tar\.gz|tgz)$') {
  $extractDir = Join-Path $ReportDir "app"
  if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }
  New-Item -ItemType Directory -Force $extractDir | Out-Null
  tar -xzf $resolvedApp -C $extractDir
  if ($LASTEXITCODE -ne 0) { Fail "Nao foi possivel extrair $AppPath" }
  $app = Get-ChildItem $extractDir -Recurse -Directory -Filter "*.app" | Select-Object -First 1
  if (-not $app) { Fail "Nenhum .app encontrado dentro de $AppPath" }
  $resolvedApp = $app.FullName
}
if ($resolvedApp -notmatch '\.app$') { Fail "Esperado um .app de simulador iOS (ou o .tar.gz do EAS)." }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$report = Join-Path $ReportDir "maestro-cloud-$stamp.xml"
$arguments = @(
  "cloud",
  "--app-file", $resolvedApp,
  "--flows", $Workspace,
  "--config", (Join-Path $Workspace $(if ($SmokeOnly -or $IncludeTags) { "config.tagged.yaml" } else { "config.yaml" })),
  "--project-id", $env:MAESTRO_PROJECT_ID,
  "--device-model", $DeviceModel,
  "--device-os", $DeviceOs,
  "--name", "athlete-coach-e2e-$stamp",
  "--format", "JUNIT",
  "--output", $report
)
if ($env:MAESTRO_CLOUD_API_KEY) { $arguments += @("--api-key", $env:MAESTRO_CLOUD_API_KEY) }
if ($SmokeOnly) { $arguments += @("--include-tags", "smoke") }
elseif ($IncludeTags) { $arguments += @("--include-tags", ($IncludeTags -join ",")) }
# Every run except the smoke-only one signs in with the E2E account.
if (-not $SmokeOnly) { $arguments += @("-e", "E2E_EMAIL=$($env:E2E_EMAIL)", "-e", "E2E_PASSWORD=$($env:E2E_PASSWORD)") }

# Flags verified against Maestro CLI 2.11.0 (`maestro cloud --help`). The API
# key and E2E credentials are passed to the CLI but never echoed by this script.
Write-Host "Maestro Cloud: $DeviceModel / $DeviceOs"
Write-Host "App: $resolvedApp"
Write-Host "Flows: $Workspace $(if ($SmokeOnly) { '(apenas smoke)' })"
Write-Host "Relatorio JUnit: $report"
& maestro @arguments
$code = $LASTEXITCODE
if ($code -eq 0) { Write-Host "Maestro Cloud: todos os fluxos passaram." -ForegroundColor Green }
else { Write-Host "Maestro Cloud: falha (codigo $code). Veja o link do upload acima e o relatorio $report." -ForegroundColor Red }
exit $code
