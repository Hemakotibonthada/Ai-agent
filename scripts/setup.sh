#!/usr/bin/env bash
# ============================================================
# NEXUS AI OS - Mac/Linux One-Time Setup Script
# Installs all dependencies and configures the environment
# ============================================================
# Usage: chmod +x scripts/setup.sh && ./scripts/setup.sh
# ============================================================

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;37m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}[*] $1${NC}"; }
ok()    { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "  ${YELLOW}[!!]${NC} $1"; }
err()   { echo -e "  ${RED}[ERR]${NC} $1"; }
info()  { echo -e "  ${GRAY}[..]${NC} $1"; }

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  NEXUS AI OS - One-Time Setup (Linux/macOS)${NC}"
echo -e "${MAGENTA}============================================================${NC}"
echo ""

START_TIME=$(date +%s)

# ============================================================
# Step 1: Check Prerequisites
# ============================================================
step "Checking prerequisites..."

# Python
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    err "Python not found!"
    echo "  Please install Python 3.11+ from https://python.org"
    exit 1
fi

PY_VERSION=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>&1)
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]; }; then
    err "Python 3.11+ required (found $PY_VERSION)"
    exit 1
fi
ok "Python $PY_VERSION"

# Node
if ! command -v node &>/dev/null; then
    err "Node.js not found!"
    echo "  Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
NODE_VER=$(node -e "console.log(process.version.replace('v',''))")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    err "Node.js 18+ required (found v$NODE_VER)"
    exit 1
fi
ok "Node.js v$NODE_VER"

# npm
if ! command -v npm &>/dev/null; then
    err "npm not found!"
    exit 1
fi
ok "npm $(npm --version 2>&1)"

# Git
if command -v git &>/dev/null; then
    ok "Git $(git --version 2>&1)"
else
    warn "Git not found (optional but recommended)"
fi

# Ollama
OLLAMA_FOUND=false
if command -v ollama &>/dev/null; then
    OLLAMA_FOUND=true
    ok "Ollama found"
else
    warn "Ollama not found. Install from https://ollama.ai for AI features."
fi

# ============================================================
# Step 2: Create Required Directories
# ============================================================
step "Creating project directories..."

DIRS=(
    "data"
    "data/backups"
    "data/chromadb"
    "logs"
    "models"
    "reports"
    "docs/screenshots"
)

for dir in "${DIRS[@]}"; do
    full_path="$PROJECT_ROOT/$dir"
    if [ ! -d "$full_path" ]; then
        mkdir -p "$full_path"
        ok "Created $dir/"
    else
        info "$dir/ already exists"
    fi
done

# ============================================================
# Step 3: Setup Backend (Python Virtual Environment)
# ============================================================
step "Setting up backend..."

BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_DIR="$BACKEND_DIR/venv"

# Create virtual environment
if [ ! -d "$VENV_DIR" ]; then
    info "Creating Python virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    ok "Virtual environment created"
else
    info "Virtual environment already exists"
fi

# Activate and install dependencies
info "Installing Python dependencies (this may take several minutes)..."
source "$VENV_DIR/bin/activate"

pip install --upgrade pip --quiet
pip install -r "$BACKEND_DIR/requirements.txt" --quiet
ok "Python dependencies installed"

# Install test dependencies
info "Installing test dependencies..."
pip install pytest pytest-asyncio httpx pytest-cov --quiet
ok "Test dependencies installed"

# ============================================================
# Step 4: Setup Frontend (Node.js)
# ============================================================
step "Setting up frontend..."

FRONTEND_DIR="$PROJECT_ROOT/frontend"
cd "$FRONTEND_DIR"

info "Installing frontend dependencies..."
npm install --silent 2>&1
ok "Frontend dependencies installed"

cd "$PROJECT_ROOT"

# ============================================================
# Step 5: Create Environment File
# ============================================================
step "Configuring environment..."

ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    SECRET_KEY=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())")
    cat > "$ENV_FILE" <<EOF
# NEXUS AI OS - Environment Configuration
# Generated by setup script on $(date '+%Y-%m-%d %H:%M:%S')

NEXUS_APP_NAME=NEXUS AI
NEXUS_VERSION=1.0.0
NEXUS_ENV=development
NEXUS_DEBUG=true
NEXUS_HOST=0.0.0.0
NEXUS_PORT=8000
NEXUS_SECRET_KEY=$SECRET_KEY

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
EOF
    ok "Environment file created: backend/.env"
else
    info "Environment file already exists"
fi

# ============================================================
# Step 6: Pull Ollama Model
# ============================================================
if [ "$OLLAMA_FOUND" = true ]; then
    step "Setting up Ollama model..."

    # Start Ollama if not running
    if curl -s --max-time 3 http://localhost:11434/api/version &>/dev/null; then
        ok "Ollama server is running"
    else
        info "Starting Ollama server..."
        ollama serve &>/dev/null &
        sleep 5
    fi

    # Pull default model
    if ! ollama list 2>/dev/null | grep -q "llama3"; then
        info "Pulling llama3.2 model (this will take a few minutes)..."
        ollama pull llama3.2
        ok "Model llama3.2 pulled successfully"
    else
        info "Default model already available"
    fi

    # Pull embedding model
    if ! ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
        info "Pulling embedding model..."
        ollama pull nomic-embed-text
        ok "Embedding model pulled"
    else
        info "Embedding model already available"
    fi
else
    warn "Skipping Ollama model setup (Ollama not installed)"
fi

# ============================================================
# Summary
# ============================================================
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  NEXUS AI OS - Setup Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  Time elapsed: ${ELAPSED}s"
echo ""
echo "  Next steps:"
echo "    1. Review backend/.env and adjust settings"
echo "    2. Run ./scripts/start.sh to start the system"
echo "    3. Open http://localhost:5173 in your browser"
echo ""
echo "  Optional:"
echo "    - Install Ollama for AI features: https://ollama.ai"
echo "    - Setup ESP32 for IoT: see docs/ESP32_SETUP.md"
echo "    - Run tests: cd backend && pytest tests/"
echo ""
echo -e "${GREEN}============================================================${NC}"
