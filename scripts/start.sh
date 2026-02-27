#!/usr/bin/env bash
# ============================================================
# NEXUS AI OS - Mac/Linux Startup Script
# Starts backend, frontend, and opens browser
# ============================================================
# Usage: chmod +x scripts/start.sh && ./scripts/start.sh
# ============================================================

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}[*] $1${NC}"; }
ok()    { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "  ${YELLOW}[!!]${NC} $1"; }
err()   { echo -e "  ${RED}[ERR]${NC} $1"; }

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  NEXUS AI OS - Startup Script (Linux/macOS)${NC}"
echo -e "${MAGENTA}============================================================${NC}"

# --- Cleanup on exit ---
BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null && echo "  Stopped backend (PID $BACKEND_PID)"
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && echo "  Stopped frontend (PID $FRONTEND_PID)"
    exit 0
}
trap cleanup SIGINT SIGTERM

# --- Check Prerequisites ---
step "Checking prerequisites..."

if ! command -v python3 &>/dev/null; then
    err "Python3 not found. Please install Python 3.11+ from https://python.org"
    exit 1
fi
ok "Python: $(python3 --version 2>&1)"

if ! command -v node &>/dev/null; then
    err "Node.js not found. Please install Node 18+ from https://nodejs.org"
    exit 1
fi
ok "Node.js: $(node --version 2>&1)"

if ! command -v ollama &>/dev/null; then
    warn "Ollama not found. AI features will be limited."
    warn "Install from https://ollama.ai"
else
    ok "Ollama: found"

    # Check if Ollama is running
    if curl -s --max-time 3 http://localhost:11434/api/version &>/dev/null; then
        ok "Ollama server is running"
    else
        warn "Ollama is not running. Starting Ollama..."
        ollama serve &>/dev/null &
        sleep 3
    fi

    # Ensure default model is pulled
    step "Checking Ollama model..."
    if ! ollama list 2>/dev/null | grep -q "llama3"; then
        warn "Default model not found. Pulling llama3.2 (this may take a while)..."
        ollama pull llama3.2
    else
        ok "Default model available"
    fi
fi

# --- Start Backend ---
step "Starting backend server..."

BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_ACTIVATE="$BACKEND_DIR/venv/bin/activate"

if [ ! -f "$VENV_ACTIVATE" ]; then
    err "Backend virtual environment not found. Run ./scripts/setup.sh first."
    exit 1
fi

(
    cd "$BACKEND_DIR"
    source "$VENV_ACTIVATE"
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
) &
BACKEND_PID=$!
ok "Backend starting on http://localhost:8000 (PID: $BACKEND_PID)"

# --- Start Frontend ---
step "Starting frontend dev server..."

FRONTEND_DIR="$PROJECT_ROOT/frontend"

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    err "Frontend dependencies not installed. Run ./scripts/setup.sh first."
    exit 1
fi

(
    cd "$FRONTEND_DIR"
    npm run dev
) &
FRONTEND_PID=$!
ok "Frontend starting on http://localhost:5173 (PID: $FRONTEND_PID)"

# --- Wait for services ---
step "Waiting for services to start..."

MAX_ATTEMPTS=30
ATTEMPT=0
BACKEND_READY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ] && [ "$BACKEND_READY" = false ]; do
    ATTEMPT=$((ATTEMPT + 1))
    sleep 2
    if curl -s --max-time 2 http://localhost:8000/health &>/dev/null; then
        BACKEND_READY=true
    else
        printf "."
    fi
done
echo ""

if [ "$BACKEND_READY" = true ]; then
    ok "Backend is ready!"
else
    warn "Backend may still be starting. Check http://localhost:8000/health"
fi

# --- Open Browser ---
step "Opening browser..."
sleep 3
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:5173" 2>/dev/null
elif command -v open &>/dev/null; then
    open "http://localhost:5173"
fi

# --- Summary ---
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  NEXUS AI OS is running!${NC}"
echo ""
echo -e "  Frontend:  http://localhost:5173"
echo -e "  Backend:   http://localhost:8000"
echo -e "  API Docs:  http://localhost:8000/docs"
echo -e "  Ollama:    http://localhost:11434"
echo ""
echo -e "  Press Ctrl+C to stop all services."
echo -e "${GREEN}============================================================${NC}"
echo ""

# Keep script running to handle cleanup
wait
