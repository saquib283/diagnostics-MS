# ==============================================================================
# DCMS Local / Windows PostgreSQL Backup Script (PowerShell)
# ==============================================================================
param(
  [Parameter(Mandatory = $true)][string]$DatabaseUrl,
  [string]$BackupDir = ".\backups",
  [string]$PgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$DumpFile = Join-Path $BackupDir "dcms_$Timestamp.dump"

& $PgDumpPath --format=custom --no-owner --no-privileges --file="$DumpFile" "$DatabaseUrl"
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

$Hash = (Get-FileHash -Path $DumpFile -Algorithm SHA256).Hash
"$Hash  $(Split-Path $DumpFile -Leaf)" | Out-File -Encoding ascii "$DumpFile.sha256"
Write-Host "Backup created and hashed: $DumpFile"

