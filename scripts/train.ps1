# ============================================================
# NEXUS AI OS - Training Trigger Script (Windows)
# Runs daily model training with backup and logging
# ============================================================
# Usage: .\scripts\train.ps1
# ============================================================

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Write-Step { param([string]$msg) Write-Host "`n[*] $msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "  [ERR] $msg" -ForegroundColor Red }

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $ProjectRoot "logs\training_$timestamp.log"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  NEXUS AI OS - Model Training Pipeline" -ForegroundColor Magenta
Write-Host "  Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta

# --- Step 1: Pre-training Backup ---
Write-Step "Creating pre-training backup..."

$backupDir = Join-Path $ProjectRoot "data\backups"
$dbPath = Join-Path $ProjectRoot "data\nexus.db"

if (Test-Path $dbPath) {
    $backupFile = Join-Path $backupDir "nexus_pre-training_$timestamp.db"
    Copy-Item -Path $dbPath -Destination $backupFile -Force
    Write-Ok "Database backed up to: $backupFile"
} else {
    Write-Warn "No database found to backup"
}

# --- Step 2: Activate Environment ---
Write-Step "Activating Python environment..."

$venvActivate = Join-Path $ProjectRoot "backend\venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Err "Virtual environment not found. Run .\scripts\setup.ps1 first."
    exit 1
}
& $venvActivate
Write-Ok "Environment activated"

# --- Step 3: Run Training ---
Write-Step "Starting model training..."

$backendDir = Join-Path $ProjectRoot "backend"
Push-Location $backendDir

try {
    $trainingStart = Get-Date
    python -c @"
import asyncio
import sys
sys.path.insert(0, '.')
from services.training_service import TrainingService

async def run_training():
    service = TrainingService()
    await service.initialize()
    result = await service.run_daily_training()
    print(f'Training result: {result}')
    return result

asyncio.run(run_training())
"@ 2>&1 | Tee-Object -FilePath $logFile

    $trainingEnd = Get-Date
    $duration = ($trainingEnd - $trainingStart).TotalSeconds
    Write-Ok "Training completed in $([math]::Round($duration, 1))s"
} catch {
    Write-Err "Training failed: $_"
    $_ | Out-File -FilePath $logFile -Append
}

Pop-Location

# --- Summary ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Training Complete" -ForegroundColor Green
Write-Host "  Log: $logFile" -ForegroundColor White
Write-Host "  Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
