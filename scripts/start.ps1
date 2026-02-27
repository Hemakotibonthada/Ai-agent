# ============================================================
# NEXUS AI OS - Windows Startup Script
# Starts backend, frontend, and opens browser
# ============================================================
# Usage: .\scripts\start.ps1
# ============================================================

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# --- Colors & Output Helpers ---
function Write-Step { param([string]$msg) Write-Host "`n[*] $msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "  [ERR] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  NEXUS AI OS - Startup Script (Windows)" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta

# --- Check Prerequisites ---
Write-Step "Checking prerequisites..."

# Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Err "Python not found. Please install Python 3.11+ from https://python.org"
    exit 1
}
$pyVer = python --version 2>&1
Write-Ok "Python: $pyVer"

# Node
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Err "Node.js not found. Please install Node 18+ from https://nodejs.org"
    exit 1
}
$nodeVer = node --version 2>&1
Write-Ok "Node.js: $nodeVer"

# Ollama
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    Write-Warn "Ollama not found. AI features will be limited."
    Write-Warn "Install from https://ollama.ai"
} else {
    Write-Ok "Ollama: found"

    # Check if Ollama is running
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:11434/api/version" -TimeoutSec 3 -ErrorAction Stop
        Write-Ok "Ollama server is running"
    } catch {
        Write-Warn "Ollama is not running. Starting Ollama..."
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 3
    }

    # Ensure default model is pulled
    Write-Step "Checking Ollama model..."
    $models = ollama list 2>&1
    if ($models -notmatch "llama3") {
        Write-Warn "Default model not found. Pulling llama3.2 (this may take a while)..."
        ollama pull llama3.2
    } else {
        Write-Ok "Default model available"
    }
}

# --- Start Backend ---
Write-Step "Starting backend server..."

$backendDir = Join-Path $ProjectRoot "backend"
$venvActivate = Join-Path $backendDir "venv\Scripts\Activate.ps1"

if (-not (Test-Path $venvActivate)) {
    Write-Err "Backend virtual environment not found. Run .\scripts\setup.ps1 first."
    exit 1
}

$backendJob = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile", "-Command",
    "Set-Location '$backendDir'; & '$venvActivate'; uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) -PassThru -WindowStyle Minimized
Write-Ok "Backend starting on http://localhost:8000 (PID: $($backendJob.Id))"

# --- Start Frontend ---
Write-Step "Starting frontend dev server..."

$frontendDir = Join-Path $ProjectRoot "frontend"
$nodeModules = Join-Path $frontendDir "node_modules"

if (-not (Test-Path $nodeModules)) {
    Write-Err "Frontend dependencies not installed. Run .\scripts\setup.ps1 first."
    exit 1
}

$frontendJob = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile", "-Command",
    "Set-Location '$frontendDir'; npm run dev"
) -PassThru -WindowStyle Minimized
Write-Ok "Frontend starting on http://localhost:5173 (PID: $($frontendJob.Id))"

# --- Wait for services to be ready ---
Write-Step "Waiting for services to start..."

$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    $attempt++
    Start-Sleep -Seconds 2
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction Stop
        $backendReady = $true
    } catch {
        Write-Host "." -NoNewline -ForegroundColor DarkGray
    }
}
Write-Host ""

if ($backendReady) {
    Write-Ok "Backend is ready!"
} else {
    Write-Warn "Backend may still be starting. Check http://localhost:8000/health"
}

# --- Open Browser ---
Write-Step "Opening browser..."
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

# --- Summary ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  NEXUS AI OS is running!" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Ollama:    http://localhost:11434" -ForegroundColor White
Write-Host "" -ForegroundColor Green
Write-Host "  Press Ctrl+C or close terminal windows to stop." -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
