# ============================================================
# NEXUS AI OS - Windows One-Time Setup Script
# Installs all dependencies and configures the environment
# ============================================================
# Usage: .\scripts\setup.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Write-Step   { param([string]$msg) Write-Host "`n[*] $msg" -ForegroundColor Cyan }
function Write-Ok     { param([string]$msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn   { param([string]$msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Err    { param([string]$msg) Write-Host "  [ERR] $msg" -ForegroundColor Red }
function Write-Info   { param([string]$msg) Write-Host "  [..] $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  NEXUS AI OS - One-Time Setup (Windows)" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

$startTime = Get-Date

# ============================================================
# Step 1: Check Prerequisites
# ============================================================
Write-Step "Checking prerequisites..."

# Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Err "Python not found!"
    Write-Host "  Please install Python 3.11+ from https://python.org" -ForegroundColor Yellow
    Write-Host "  Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
    exit 1
}
$pyVersion = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>&1
$pyMajor, $pyMinor = $pyVersion -split '\.'
if ([int]$pyMajor -lt 3 -or ([int]$pyMajor -eq 3 -and [int]$pyMinor -lt 11)) {
    Write-Err "Python 3.11+ required (found $pyVersion)"
    exit 1
}
Write-Ok "Python $pyVersion"

# Node
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Err "Node.js not found!"
    Write-Host "  Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}
$nodeVer = node -e "console.log(process.version.replace('v',''))" 2>&1
$nodeMajor = ($nodeVer -split '\.')[0]
if ([int]$nodeMajor -lt 18) {
    Write-Err "Node.js 18+ required (found v$nodeVer)"
    exit 1
}
Write-Ok "Node.js v$nodeVer"

# npm
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Err "npm not found!"
    exit 1
}
Write-Ok "npm $(npm --version 2>&1)"

# Git
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    Write-Ok "Git $(git --version 2>&1)"
} else {
    Write-Warn "Git not found (optional but recommended)"
}

# Ollama
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollama) {
    Write-Ok "Ollama found"
} else {
    Write-Warn "Ollama not found. Install from https://ollama.ai for AI features."
}

# ============================================================
# Step 2: Create Required Directories
# ============================================================
Write-Step "Creating project directories..."

$directories = @(
    "data",
    "data/backups",
    "data/chromadb",
    "logs",
    "models",
    "reports",
    "docs/screenshots"
)

foreach ($dir in $directories) {
    $fullPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        Write-Ok "Created $dir/"
    } else {
        Write-Info "$dir/ already exists"
    }
}

# ============================================================
# Step 3: Setup Backend (Python Virtual Environment)
# ============================================================
Write-Step "Setting up backend..."

$backendDir = Join-Path $ProjectRoot "backend"
$venvDir = Join-Path $backendDir "venv"
$venvActivate = Join-Path $venvDir "Scripts\Activate.ps1"

# Create virtual environment
if (-not (Test-Path $venvDir)) {
    Write-Info "Creating Python virtual environment..."
    python -m venv "$venvDir"
    Write-Ok "Virtual environment created"
} else {
    Write-Info "Virtual environment already exists"
}

# Activate and install dependencies
Write-Info "Installing Python dependencies (this may take several minutes)..."
& $venvActivate

$reqFile = Join-Path $backendDir "requirements.txt"
pip install --upgrade pip | Out-Null
pip install -r "$reqFile" 2>&1 | ForEach-Object {
    if ($_ -match "Successfully installed") { Write-Ok $_ }
}
Write-Ok "Python dependencies installed"

# Install test dependencies
Write-Info "Installing test dependencies..."
pip install pytest pytest-asyncio httpx pytest-cov 2>&1 | Out-Null
Write-Ok "Test dependencies installed"

# ============================================================
# Step 4: Setup Frontend (Node.js)
# ============================================================
Write-Step "Setting up frontend..."

$frontendDir = Join-Path $ProjectRoot "frontend"
Push-Location $frontendDir

Write-Info "Installing frontend dependencies..."
npm install 2>&1 | Out-Null
Write-Ok "Frontend dependencies installed"

Pop-Location

# ============================================================
# Step 5: Create Environment File
# ============================================================
Write-Step "Configuring environment..."

$envFile = Join-Path $backendDir ".env"
if (-not (Test-Path $envFile)) {
    $envContent = @"
# NEXUS AI OS - Environment Configuration
# Generated by setup script on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

NEXUS_APP_NAME=NEXUS AI
NEXUS_VERSION=1.0.0
NEXUS_ENV=development
NEXUS_DEBUG=true
NEXUS_HOST=0.0.0.0
NEXUS_PORT=8000
NEXUS_SECRET_KEY=$(New-Guid)

NEXUS_DB_PATH=./data/nexus.db
NEXUS_VECTOR_DB_PATH=./data/chromadb
NEXUS_BACKUP_PATH=./data/backups

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_USERNAME=nexus
MQTT_PASSWORD=nexus_mqtt_password

LOG_LEVEL=DEBUG
LOG_FILE_PATH=./logs/nexus.log

USER_NAME=User
USER_TIMEZONE=UTC
"@
    Set-Content -Path $envFile -Value $envContent
    Write-Ok "Environment file created: backend/.env"
} else {
    Write-Info "Environment file already exists"
}

# ============================================================
# Step 6: Pull Ollama Model
# ============================================================
if ($ollama) {
    Write-Step "Setting up Ollama model..."

    # Start Ollama if not running
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:11434/api/version" -TimeoutSec 3 -ErrorAction Stop
        Write-Ok "Ollama server is running"
    } catch {
        Write-Info "Starting Ollama server..."
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 5
    }

    # Pull default model
    $models = ollama list 2>&1
    if ($models -notmatch "llama3") {
        Write-Info "Pulling llama3.2 model (this will take a few minutes)..."
        ollama pull llama3.2
        Write-Ok "Model llama3.2 pulled successfully"
    } else {
        Write-Info "Default model already available"
    }

    # Pull embedding model
    if ($models -notmatch "nomic-embed-text") {
        Write-Info "Pulling embedding model..."
        ollama pull nomic-embed-text
        Write-Ok "Embedding model pulled"
    } else {
        Write-Info "Embedding model already available"
    }
} else {
    Write-Warn "Skipping Ollama model setup (Ollama not installed)"
}

# ============================================================
# Summary
# ============================================================
$elapsed = (Get-Date) - $startTime

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  NEXUS AI OS - Setup Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Time elapsed: $([math]::Round($elapsed.TotalSeconds))s" -ForegroundColor White
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "    1. Review backend/.env and adjust settings" -ForegroundColor Gray
Write-Host "    2. Run .\scripts\start.ps1 to start the system" -ForegroundColor Gray
Write-Host "    3. Open http://localhost:5173 in your browser" -ForegroundColor Gray
Write-Host ""
Write-Host "  Optional:" -ForegroundColor White
Write-Host "    - Install Ollama for AI features: https://ollama.ai" -ForegroundColor Gray
Write-Host "    - Setup ESP32 for IoT: see docs/ESP32_SETUP.md" -ForegroundColor Gray
Write-Host "    - Run tests: cd backend && pytest tests/" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
