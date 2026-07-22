# Slack Agent Bridge — pack clean zip for another project
#
# Usage (from this folder):
#   powershell -ExecutionPolicy Bypass -File .\pack.ps1
#
# Output:
#   ../slack-agent-bridge-portable.zip

$ErrorActionPreference = "Stop"

$PackageRoot = $PSScriptRoot
$OutDir = Split-Path $PackageRoot -Parent
$Stamp = Get-Date -Format "yyyyMMdd-HHmm"
$ZipPath = Join-Path $OutDir "slack-agent-bridge-portable-$Stamp.zip"
$Staging = Join-Path $env:TEMP "slack-agent-bridge-pack-$Stamp"

if (Test-Path $Staging) {
  Remove-Item $Staging -Recurse -Force
}
New-Item -ItemType Directory -Path $Staging | Out-Null

$dest = Join-Path $Staging "slack-agent-bridge"
New-Item -ItemType Directory -Path $dest | Out-Null

$include = @(
  "src",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  ".env.example",
  ".gitignore",
  "README.md",
  "CURSOR_INSTALL.md",
  "pack.ps1"
)

foreach ($item in $include) {
  $src = Join-Path $PackageRoot $item
  if (-not (Test-Path $src)) {
    Write-Warning "Skipping missing: $item"
    continue
  }
  $target = Join-Path $dest $item
  if (Test-Path $src -PathType Container) {
    Copy-Item $src $target -Recurse -Force
  } else {
    Copy-Item $src $target -Force
  }
}

# Never ship secrets or local run state
@(
  (Join-Path $dest ".env"),
  (Join-Path $dest "node_modules"),
  (Join-Path $dest "logs")
) | ForEach-Object {
  if (Test-Path $_) { Remove-Item $_ -Recurse -Force }
}

if (Test-Path $ZipPath) {
  Remove-Item $ZipPath -Force
}

Compress-Archive -Path $dest -DestinationPath $ZipPath -Force
Remove-Item $Staging -Recurse -Force

Write-Host ""
Write-Host "Packed: $ZipPath"
Write-Host ""
Write-Host "Install in another project:"
Write-Host "  1. Unzip into <repo>/tools/slack-agent-bridge"
Write-Host "  2. Open the repo in Cursor"
Write-Host "  3. Ask Cursor: Install the Slack agent bridge using tools/slack-agent-bridge/CURSOR_INSTALL.md"
Write-Host ""
