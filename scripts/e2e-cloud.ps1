<#
.SYNOPSIS
  Cloud E2E helper: build (EAS), download the latest E2E build, test (Maestro
  Cloud). Nothing paid runs by default: without a mode it only prints usage.

.EXAMPLE
  ./scripts/e2e-cloud.ps1 -Build      # starts an EAS cloud build (asks first)
  ./scripts/e2e-cloud.ps1 -Download   # downloads the latest finished e2e-cloud build
  ./scripts/e2e-cloud.ps1 -Test       # runs Maestro Cloud on the downloaded build
  ./scripts/e2e-cloud.ps1 -All        # Build (asks) + Download + Test
#>
[CmdletBinding()]
param(
  [switch]$Build,
  [switch]$Download,
  [switch]$Test,
  [switch]$All,
  [switch]$SmokeOnly,
  [string]$AppPath = "artifacts/e2e/build.tar.gz"
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (-not ($Build -or $Download -or $Test -or $All)) {
  Write-Host "Uso: ./scripts/e2e-cloud.ps1 -Build | -Download | -Test | -All [-SmokeOnly]"
  Write-Host "Nenhum build em nuvem e iniciado sem um modo explicito. Veja e2e/README.md."
  exit 0
}

if ($Build -or $All) {
  $answer = Read-Host "Iniciar um build EAS (consome creditos de build em nuvem)? Digite 'sim' para continuar"
  if ($answer -ne "sim") { Write-Host "Build cancelado."; exit 1 }
  Push-Location "apps/mobile"
  try {
    & eas build --platform ios --profile e2e-cloud --non-interactive --wait
    if ($LASTEXITCODE -ne 0) { throw "EAS build falhou (codigo $LASTEXITCODE)." }
  } finally { Pop-Location }
}

if ($Download -or $All) {
  Push-Location "apps/mobile"
  try {
    $json = & eas build:list --platform ios --build-profile e2e-cloud --status finished --limit 1 --json --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel listar builds EAS." }
  } finally { Pop-Location }
  $builds = $json | ConvertFrom-Json
  $url = $builds[0].artifacts.buildUrl
  if (-not $url) { throw "Nenhum build e2e-cloud finalizado encontrado." }
  New-Item -ItemType Directory -Force (Split-Path $AppPath) | Out-Null
  Write-Host "Baixando o build $($builds[0].id) para $AppPath"
  Invoke-WebRequest -Uri $url -OutFile $AppPath
}

if ($Test -or $All) {
  $runner = Join-Path $PSScriptRoot "run-maestro-cloud.ps1"
  if ($SmokeOnly) { & $runner -AppPath $AppPath -SmokeOnly } else { & $runner -AppPath $AppPath }
  exit $LASTEXITCODE
}
