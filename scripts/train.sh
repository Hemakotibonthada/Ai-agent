#!/usr/bin/env bash
# ============================================================
# NEXUS AI OS - Training Trigger Script (Linux/macOS)
# Runs daily model training with backup and logging
# ============================================================
# Usage: chmod +x scripts/train.sh && ./scripts/train.sh
# ============================================================

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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

TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
LOG_FILE="$PROJECT_ROOT/logs/training_$TIMESTAMP.log"

echo ""
echo -e "${MAGENTA}============================================================${NC}"
echo -e "${MAGENTA}  NEXUS AI OS - Model Training Pipeline${NC}"
echo -e "${MAGENTA}  Started: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${MAGENTA}============================================================${NC}"

# --- Step 1: Pre-training Backup ---
step "Creating pre-training backup..."

BACKUP_DIR="$PROJECT_ROOT/data/backups"
DB_PATH="$PROJECT_ROOT/data/nexus.db"
mkdir -p "$BACKUP_DIR"

if [ -f "$DB_PATH" ]; then
    BACKUP_FILE="$BACKUP_DIR/nexus_pre-training_$TIMESTAMP.db"
    cp "$DB_PATH" "$BACKUP_FILE"
    ok "Database backed up to: $BACKUP_FILE"
else
    warn "No database found to backup"
fi

# --- Step 2: Activate Environment ---
step "Activating Python environment..."

VENV_ACTIVATE="$PROJECT_ROOT/backend/venv/bin/activate"
if [ ! -f "$VENV_ACTIVATE" ]; then
    err "Virtual environment not found. Run ./scripts/setup.sh first."
    exit 1
fi
source "$VENV_ACTIVATE"
ok "Environment activated"

# --- Step 3: Run Training ---
step "Starting model training..."

cd "$PROJECT_ROOT/backend"
TRAINING_START=$(date +%s)

python3 -c "
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
" 2>&1 | tee "$LOG_FILE"

TRAINING_END=$(date +%s)
DURATION=$((TRAINING_END - TRAINING_START))
ok "Training completed in ${DURATION}s"

cd "$PROJECT_ROOT"

# --- Summary ---
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Training Complete${NC}"
echo "  Log: $LOG_FILE"
echo "  Finished: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${GREEN}============================================================${NC}"
