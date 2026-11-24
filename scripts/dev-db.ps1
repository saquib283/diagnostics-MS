param(
  [ValidateSet("init", "start", "stop", "status")]
  [string]$Action = "status",
  [int]$Port = 5435,
  [string]$DataDir = ".local-pgdata",
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin"
)

$ErrorActionPreference = "Stop"
$FullDataDir = Join-Path (Get-Location) $DataDir
$InitDb = Join-Path $PgBin "initdb.exe"
$PgCtl = Join-Path $PgBin "pg_ctl.exe"
$Createdb = Join-Path $PgBin "createdb.exe"

if (-not (Test-Path $PgCtl)) {
  Write-Error "PostgreSQL binaries not found at $PgBin. Pass -PgBin or use an external DATABASE_URL."
}

switch ($Action) {
  "init" {
    if (-not (Test-Path $FullDataDir)) {
      & $InitDb -D $FullDataDir -U postgres -A trust -E UTF8 --no-locale
    }
    Write-Host "Initialized local PostgreSQL data directory at $FullDataDir"
  }
  "start" {
    if (-not (Test-Path $FullDataDir)) {
      & $InitDb -D $FullDataDir -U postgres -A trust -E UTF8 --no-locale
    }
    Start-Process -FilePath (Join-Path $PgBin "postgres.exe") -ArgumentList "-D `"$FullDataDir`" -p $Port -h 127.0.0.1" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    & $Createdb -h 127.0.0.1 -p $Port -U postgres dcms 2>$null
    Write-Host "PostgreSQL running on postgresql://postgres@127.0.0.1:${Port}/dcms?schema=public"
  }
  "stop" {
    & $PgCtl -D $FullDataDir stop -m fast
  }
  "status" {
    if (Test-Path $FullDataDir) {
      & $PgCtl -D $FullDataDir status
    } else {
      Write-Host "No local PostgreSQL data directory at $FullDataDir"
    }
  }
}

