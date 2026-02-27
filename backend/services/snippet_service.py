"""
Snippet Management Service for Nexus AI
Code snippet storage, search, versioning, and sharing
"""

import hashlib
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class SnippetLanguage(str, Enum):
    PYTHON = "python"
    TYPESCRIPT = "typescript"
    JAVASCRIPT = "javascript"
    RUST = "rust"
    GO = "go"
    JAVA = "java"
    CPP = "cpp"
    C = "c"
    CSHARP = "csharp"
    RUBY = "ruby"
    PHP = "php"
    SWIFT = "swift"
    KOTLIN = "kotlin"
    SCALA = "scala"
    SQL = "sql"
    BASH = "bash"
    POWERSHELL = "powershell"
    YAML = "yaml"
    JSON = "json"
    TOML = "toml"
    HTML = "html"
    CSS = "css"
    MARKDOWN = "markdown"
    DOCKERFILE = "dockerfile"
    TERRAFORM = "terraform"
    GRAPHQL = "graphql"
    PROTOBUF = "protobuf"
    OTHER = "other"


class SnippetVisibility(str, Enum):
    PRIVATE = "private"
    TEAM = "team"
    PUBLIC = "public"


@dataclass
class SnippetVersion:
    version_id: str
    version_number: int
    code: str
    description: str
    created_at: str
    created_by: str
    diff_from_previous: Optional[str] = None
    line_count: int = 0
    char_count: int = 0


@dataclass
class SnippetComment:
    comment_id: str
    user_id: str
    user_name: str
    content: str
    created_at: str
    updated_at: Optional[str] = None
    line_number: Optional[int] = None
    reactions: Dict[str, int] = field(default_factory=dict)


@dataclass
class Snippet:
    snippet_id: str
    title: str
    description: str
    language: SnippetLanguage
    code: str
    visibility: SnippetVisibility
    created_by: str
    created_at: str
    updated_at: str
    folder: str = "Uncategorized"
    tags: List[str] = field(default_factory=list)
    starred: bool = False
    pinned: bool = False
    usage_count: int = 0
    copy_count: int = 0
    view_count: int = 0
    line_count: int = 0
    char_count: int = 0
    file_extension: str = ""
    dependencies: List[str] = field(default_factory=list)
    related_snippets: List[str] = field(default_factory=list)
    versions: List[SnippetVersion] = field(default_factory=list)
    comments: List[SnippetComment] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def current_version(self) -> int:
        return len(self.versions)

    @property
    def checksum(self) -> str:
        return hashlib.md5(self.code.encode()).hexdigest()[:8]


@dataclass
class SnippetFolder:
    folder_id: str
    name: str
    parent_id: Optional[str]
    snippet_count: int = 0
    color: str = "#6366f1"
    icon: str = "folder"
    sort_order: int = 0
    created_at: str = ""


class SnippetService:
    """Comprehensive snippet management service"""

    def __init__(self):
        self.snippets: Dict[str, Snippet] = {}
        self.folders: Dict[str, SnippetFolder] = {}
        self._tag_index: Dict[str, Set[str]] = {}
        self._language_index: Dict[SnippetLanguage, Set[str]] = {}
        self._search_index: Dict[str, Set[str]] = {}
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Initialize with sample snippets"""
        # Create folders
        sample_folders = [
            SnippetFolder("fld_001", "API Utilities", None, color="#3b82f6", icon="api"),
            SnippetFolder("fld_002", "Data Processing", None, color="#10b981", icon="database"),
            SnippetFolder("fld_003", "Authentication", None, color="#f59e0b", icon="lock"),
            SnippetFolder("fld_004", "Testing", None, color="#ef4444", icon="test-tube"),
            SnippetFolder("fld_005", "DevOps", None, color="#8b5cf6", icon="server"),
            SnippetFolder("fld_006", "Machine Learning", None, color="#ec4899", icon="brain"),
            SnippetFolder("fld_007", "Frontend", None, color="#06b6d4", icon="layout"),
            SnippetFolder("fld_008", "Database Queries", None, color="#14b8a6", icon="table"),
        ]
        for f in sample_folders:
            f.created_at = "2024-01-01T00:00:00Z"
            self.folders[f.folder_id] = f

        # Sample snippets
        samples = [
            Snippet(
                snippet_id="snp_001", title="FastAPI CRUD Router",
                description="Complete CRUD router with Pydantic models and dependency injection",
                language=SnippetLanguage.PYTHON,
                code='''from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/items", tags=["items"])

class ItemCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    tags: List[str] = []

class ItemResponse(ItemCreate):
    id: str
    created_at: datetime
    updated_at: datetime

@router.get("/", response_model=List[ItemResponse])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    search: Optional[str] = None,
):
    """List items with pagination and search"""
    items = get_items(skip=skip, limit=limit, search=search)
    return items

@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    """Get a single item by ID"""
    item = get_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/", response_model=ItemResponse, status_code=201)
async def create_item(item: ItemCreate):
    """Create a new item"""
    return create_new_item(item)

@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, item: ItemCreate):
    """Update an existing item"""
    updated = update_existing_item(item_id, item)
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated

@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: str):
    """Delete an item"""
    if not delete_existing_item(item_id):
        raise HTTPException(status_code=404, detail="Item not found")
''',
                visibility=SnippetVisibility.PUBLIC,
                created_by="admin", created_at="2024-01-15T10:00:00Z",
                updated_at="2024-03-10T14:00:00Z",
                folder="API Utilities",
                tags=["fastapi", "crud", "rest", "pydantic"],
                starred=True, usage_count=45, copy_count=23, view_count=189,
                file_extension=".py",
                dependencies=["fastapi", "pydantic"],
            ),
            Snippet(
                snippet_id="snp_002", title="TypeScript React Hook with Zustand",
                description="Custom React hook with Zustand store for state management",
                language=SnippetLanguage.TYPESCRIPT,
                code='''import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useCallback, useEffect } from 'react';

interface DataItem {
  id: string;
  name: string;
  value: number;
  status: 'active' | 'inactive';
  updatedAt: Date;
}

interface DataStore {
  items: DataItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  fetchItems: () => Promise<void>;
  addItem: (item: Omit<DataItem, 'id' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<DataItem>) => void;
  deleteItem: (id: string) => void;
  selectItem: (id: string | null) => void;
}

export const useDataStore = create<DataStore>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        loading: false,
        error: null,
        selectedId: null,

        fetchItems: async () => {
          set({ loading: true, error: null });
          try {
            const res = await fetch('/api/v1/items');
            const data = await res.json();
            set({ items: data, loading: false });
          } catch (err) {
            set({ error: (err as Error).message, loading: false });
          }
        },

        addItem: (item) => {
          const newItem: DataItem = {
            ...item,
            id: crypto.randomUUID(),
            updatedAt: new Date(),
          };
          set((state) => ({ items: [...state.items, newItem] }));
        },

        updateItem: (id, updates) => {
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id
                ? { ...item, ...updates, updatedAt: new Date() }
                : item
            ),
          }));
        },

        deleteItem: (id) => {
          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
          }));
        },

        selectItem: (id) => set({ selectedId: id }),
      }),
      { name: 'data-store' }
    )
  )
);

export function useDataManager() {
  const store = useDataStore();

  useEffect(() => {
    store.fetchItems();
  }, []);

  const selectedItem = store.items.find((i) => i.id === store.selectedId);

  const activeItems = useCallback(
    () => store.items.filter((i) => i.status === 'active'),
    [store.items]
  );

  return {
    ...store,
    selectedItem,
    activeItems: activeItems(),
    totalCount: store.items.length,
  };
}
''',
                visibility=SnippetVisibility.PUBLIC,
                created_by="david.kim", created_at="2024-02-05T09:00:00Z",
                updated_at="2024-03-15T11:00:00Z",
                folder="Frontend",
                tags=["react", "zustand", "hooks", "typescript", "state-management"],
                starred=True, usage_count=67, copy_count=34, view_count=245,
                file_extension=".ts",
                dependencies=["zustand", "react"],
            ),
            Snippet(
                snippet_id="snp_003", title="Async Retry with Backoff",
                description="Async retry decorator with exponential backoff and jitter",
                language=SnippetLanguage.PYTHON,
                code='''import asyncio
import functools
import random
import logging
from typing import Type, Tuple, Optional, Callable

logger = logging.getLogger(__name__)

def async_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retry_on: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable] = None,
):
    """
    Async retry decorator with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay cap in seconds
        exponential_base: Base for exponential calculation
        jitter: Add random jitter to prevent thundering herd
        retry_on: Tuple of exception types to retry on
        on_retry: Optional callback(attempt, exception, delay)
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retry_on as e:
                    last_exception = e

                    if attempt == max_retries:
                        logger.error(
                            f"{func.__name__} failed after {max_retries} retries: {e}"
                        )
                        raise

                    delay = min(
                        base_delay * (exponential_base ** attempt),
                        max_delay
                    )

                    if jitter:
                        delay = delay * (0.5 + random.random())

                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1}/{max_retries} "
                        f"failed: {e}. Retrying in {delay:.2f}s"
                    )

                    if on_retry:
                        on_retry(attempt + 1, e, delay)

                    await asyncio.sleep(delay)

            raise last_exception

        return wrapper
    return decorator


# Usage example
@async_retry(max_retries=3, base_delay=0.5, retry_on=(ConnectionError, TimeoutError))
async def fetch_with_retry(url: str) -> dict:
    """Fetch data with automatic retry on connection issues"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            resp.raise_for_status()
            return await resp.json()
''',
                visibility=SnippetVisibility.PUBLIC,
                created_by="sarah.chen", created_at="2024-01-20T14:00:00Z",
                updated_at="2024-02-28T10:00:00Z",
                folder="API Utilities",
                tags=["async", "retry", "backoff", "decorator", "resilience"],
                starred=True, usage_count=89, copy_count=56, view_count=312,
                file_extension=".py",
                dependencies=["aiohttp"],
            ),
            Snippet(
                snippet_id="snp_004", title="SQL Window Functions Cheatsheet",
                description="Common SQL window functions for analytics queries",
                language=SnippetLanguage.SQL,
                code='''-- Running totals
SELECT
    date,
    revenue,
    SUM(revenue) OVER (ORDER BY date) as running_total,
    SUM(revenue) OVER (
        PARTITION BY EXTRACT(MONTH FROM date)
        ORDER BY date
    ) as monthly_running_total
FROM daily_revenue;

-- Ranking
SELECT
    user_id,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) as row_num,
    RANK() OVER (ORDER BY score DESC) as rank,
    DENSE_RANK() OVER (ORDER BY score DESC) as dense_rank,
    NTILE(4) OVER (ORDER BY score DESC) as quartile,
    PERCENT_RANK() OVER (ORDER BY score DESC) as pct_rank
FROM user_scores;

-- Moving averages
SELECT
    date,
    value,
    AVG(value) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as moving_avg_7d,
    AVG(value) OVER (
        ORDER BY date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) as moving_avg_30d
FROM metrics;

-- Lead/Lag comparisons
SELECT
    date,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY date) as prev_day,
    LEAD(revenue, 1) OVER (ORDER BY date) as next_day,
    revenue - LAG(revenue, 1) OVER (ORDER BY date) as day_over_day,
    ROUND(
        (revenue - LAG(revenue, 1) OVER (ORDER BY date))
        / LAG(revenue, 1) OVER (ORDER BY date) * 100, 2
    ) as pct_change
FROM daily_revenue;

-- First/Last values per group
SELECT DISTINCT
    department,
    FIRST_VALUE(employee_name) OVER (
        PARTITION BY department
        ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as highest_paid,
    LAST_VALUE(employee_name) OVER (
        PARTITION BY department
        ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as lowest_paid
FROM employees;
''',
                visibility=SnippetVisibility.PUBLIC,
                created_by="emily.wang", created_at="2024-02-15T11:00:00Z",
                updated_at="2024-03-05T09:00:00Z",
                folder="Database Queries",
                tags=["sql", "window-functions", "analytics", "cheatsheet"],
                starred=False, usage_count=34, copy_count=28, view_count=178,
                file_extension=".sql",
            ),
            Snippet(
                snippet_id="snp_005", title="Docker Compose Multi-Service",
                description="Production-ready Docker Compose with multiple services",
                language=SnippetLanguage.YAML,
                code='''version: "3.9"

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      args:
        - NODE_ENV=production
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/app
      - REDIS_URL=redis://cache:6379/0
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - backend
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/app
      - REDIS_URL=redis://cache:6379/0
    depends_on:
      - api
      - cache
    deploy:
      replicas: 3
    networks:
      - backend
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d app"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend
    restart: unless-stopped

  cache:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api
    networks:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  backend:
    driver: bridge
''',
                visibility=SnippetVisibility.TEAM,
                created_by="sarah.chen", created_at="2024-01-25T16:00:00Z",
                updated_at="2024-03-12T13:00:00Z",
                folder="DevOps",
                tags=["docker", "compose", "production", "multi-service", "postgres", "redis"],
                starred=True, usage_count=23, copy_count=15, view_count=156,
                file_extension=".yml",
                dependencies=["docker", "docker-compose"],
            ),
            Snippet(
                snippet_id="snp_006", title="Bash Script Template",
                description="Production-ready Bash script template with error handling and logging",
                language=SnippetLanguage.BASH,
                code='''#!/usr/bin/env bash
set -euo pipefail
IFS=$'\\n\\t'

# ===== Configuration =====
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="/var/log/${SCRIPT_NAME%.sh}.log"
readonly LOCK_FILE="/tmp/${SCRIPT_NAME%.sh}.lock"

# ===== Color codes =====
readonly RED='\\033[0;31m'
readonly GREEN='\\033[0;32m'
readonly YELLOW='\\033[1;33m'
readonly BLUE='\\033[0;34m'
readonly NC='\\033[0m'

# ===== Logging =====
log() { echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] [${GREEN}INFO${NC}] $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] [${YELLOW}WARN${NC}] $*" | tee -a "$LOG_FILE" >&2; }
error() { echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] [${RED}ERROR${NC}] $*" | tee -a "$LOG_FILE" >&2; }

# ===== Error handling =====
cleanup() {
    local exit_code=$?
    rm -f "$LOCK_FILE"
    if [[ $exit_code -ne 0 ]]; then
        error "Script exited with code $exit_code"
    fi
    exit $exit_code
}
trap cleanup EXIT
trap 'error "Script interrupted"; exit 1' INT TERM

# ===== Lock file =====
if [[ -f "$LOCK_FILE" ]]; then
    error "Another instance is already running (lock: $LOCK_FILE)"
    exit 1
fi
echo $$ > "$LOCK_FILE"

# ===== Usage =====
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

Options:
    -h, --help          Show this help message
    -v, --verbose       Enable verbose output
    -d, --dry-run       Run without making changes
    -e, --env ENV       Environment (dev|staging|prod)

Examples:
    $SCRIPT_NAME --env prod
    $SCRIPT_NAME --dry-run --verbose
EOF
}

# ===== Argument parsing =====
VERBOSE=false
DRY_RUN=false
ENVIRONMENT="dev"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        -v|--verbose) VERBOSE=true; shift ;;
        -d|--dry-run) DRY_RUN=true; shift ;;
        -e|--env) ENVIRONMENT="$2"; shift 2 ;;
        *) error "Unknown option: $1"; usage; exit 1 ;;
    esac
done

# ===== Validation =====
[[ "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]] || { error "Invalid env: $ENVIRONMENT"; exit 1; }

# ===== Main =====
main() {
    log "Starting $SCRIPT_NAME (env=$ENVIRONMENT, dry_run=$DRY_RUN)"

    # Your logic here
    log "Processing..."

    log "Completed successfully"
}

main "$@"
''',
                visibility=SnippetVisibility.PUBLIC,
                created_by="sarah.chen", created_at="2024-02-08T10:00:00Z",
                updated_at="2024-02-08T10:00:00Z",
                folder="DevOps",
                tags=["bash", "template", "error-handling", "logging", "production"],
                starred=False, usage_count=56, copy_count=41, view_count=267,
                file_extension=".sh",
            ),
            Snippet(
                snippet_id="snp_007", title="PyTorch Training Loop",
                description="Standard PyTorch training loop with mixed precision, gradient accumulation, and logging",
                language=SnippetLanguage.PYTHON,
                code='''import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.cuda.amp import autocast, GradScaler
from tqdm import tqdm
import logging

logger = logging.getLogger(__name__)

def train_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
    scaler: GradScaler,
    scheduler=None,
    gradient_accumulation_steps: int = 1,
    max_grad_norm: float = 1.0,
    epoch: int = 0,
):
    """Train for one epoch with mixed precision and gradient accumulation."""
    model.train()
    total_loss = 0.0
    num_batches = 0

    progress = tqdm(dataloader, desc=f"Epoch {epoch}", leave=False)

    for step, batch in enumerate(progress):
        inputs = batch["input_ids"].to(device)
        labels = batch["labels"].to(device)
        attention_mask = batch.get("attention_mask", None)
        if attention_mask is not None:
            attention_mask = attention_mask.to(device)

        with autocast():
            outputs = model(inputs, attention_mask=attention_mask)
            loss = criterion(outputs, labels)
            loss = loss / gradient_accumulation_steps

        scaler.scale(loss).backward()

        if (step + 1) % gradient_accumulation_steps == 0:
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()

            if scheduler is not None:
                scheduler.step()

        total_loss += loss.item() * gradient_accumulation_steps
        num_batches += 1

        progress.set_postfix({
            "loss": f"{total_loss / num_batches:.4f}",
            "lr": f"{optimizer.param_groups[0]['lr']:.2e}",
        })

    avg_loss = total_loss / max(num_batches, 1)
    logger.info(f"Epoch {epoch} - Avg Loss: {avg_loss:.4f}")
    return avg_loss


@torch.no_grad()
def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
):
    """Evaluate model on validation set."""
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0

    for batch in tqdm(dataloader, desc="Evaluating", leave=False):
        inputs = batch["input_ids"].to(device)
        labels = batch["labels"].to(device)

        with autocast():
            outputs = model(inputs)
            loss = criterion(outputs, labels)

        total_loss += loss.item()
        preds = outputs.argmax(dim=-1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    avg_loss = total_loss / len(dataloader)
    accuracy = correct / max(total, 1)

    return {"loss": avg_loss, "accuracy": accuracy}
''',
                visibility=SnippetVisibility.TEAM,
                created_by="emily.wang", created_at="2024-02-20T09:00:00Z",
                updated_at="2024-03-18T15:00:00Z",
                folder="Machine Learning",
                tags=["pytorch", "training", "mixed-precision", "gradient-accumulation", "deep-learning"],
                starred=True, usage_count=28, copy_count=19, view_count=145,
                file_extension=".py",
                dependencies=["torch", "tqdm"],
            ),
            Snippet(
                snippet_id="snp_008", title="React Data Table Component",
                description="Sortable, filterable, paginated data table with TypeScript",
                language=SnippetLanguage.TYPESCRIPT,
                code='''import React, { useState, useMemo, useCallback } from 'react';

interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(0);

  const handleSort = useCallback((key: keyof T) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortKey, sortDir]);

  const processed = useMemo(() => {
    let result = [...data];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => String(row[col.key]).toLowerCase().includes(s))
      );
    }

    if (sortKey && sortDir) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, search, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(processed.length / pageSize);
  const paged = processed.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="w-full">
      {searchable && (
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search..."
          className="mb-4 w-full rounded border px-3 py-2"
        />
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={() => col.sortable && handleSort(col.key)}
                className={col.sortable ? 'cursor-pointer select-none' : ''}
                style={{ width: col.width }}
              >
                {col.header}
                {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-100' : ''}
            >
              {columns.map((col) => (
                <td key={String(col.key)}>
                  {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between">
        <span>{processed.length} results</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Previous
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
''',
                visibility=SnippetVisibility.PUBLIC,
                created_by="david.kim", created_at="2024-03-01T10:00:00Z",
                updated_at="2024-03-19T14:00:00Z",
                folder="Frontend",
                tags=["react", "typescript", "table", "pagination", "sorting", "filtering"],
                starred=False, usage_count=41, copy_count=22, view_count=198,
                file_extension=".tsx",
                dependencies=["react"],
            ),
        ]

        for s in samples:
            s.line_count = s.code.count('\n') + 1
            s.char_count = len(s.code)
            # Create initial version
            s.versions = [SnippetVersion(
                version_id=f"v_{s.snippet_id}_1",
                version_number=1,
                code=s.code,
                description="Initial version",
                created_at=s.created_at,
                created_by=s.created_by,
                line_count=s.line_count,
                char_count=s.char_count,
            )]
            self.snippets[s.snippet_id] = s
            self._index_snippet(s)

    def _index_snippet(self, snippet: Snippet):
        """Index snippet for search"""
        for tag in snippet.tags:
            if tag not in self._tag_index:
                self._tag_index[tag] = set()
            self._tag_index[tag].add(snippet.snippet_id)

        if snippet.language not in self._language_index:
            self._language_index[snippet.language] = set()
        self._language_index[snippet.language].add(snippet.snippet_id)

        # Word index for full-text search
        words = set()
        words.update(snippet.title.lower().split())
        words.update(snippet.description.lower().split())
        words.update(t.lower() for t in snippet.tags)
        for word in words:
            if word not in self._search_index:
                self._search_index[word] = set()
            self._search_index[word].add(snippet.snippet_id)

    # ---- CRUD ----

    def list_snippets(
        self,
        language: Optional[SnippetLanguage] = None,
        folder: Optional[str] = None,
        tag: Optional[str] = None,
        search: Optional[str] = None,
        visibility: Optional[SnippetVisibility] = None,
        starred: Optional[bool] = None,
        sort_by: str = "updated_at",
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """List snippets with filtering and search"""
        results: Optional[Set[str]] = None

        if language and language in self._language_index:
            results = self._language_index[language].copy()
        if tag and tag in self._tag_index:
            tag_set = self._tag_index[tag]
            results = results & tag_set if results else tag_set.copy()

        if results is not None:
            snippets = [self.snippets[sid] for sid in results if sid in self.snippets]
        else:
            snippets = list(self.snippets.values())

        if folder:
            snippets = [s for s in snippets if s.folder == folder]
        if visibility:
            snippets = [s for s in snippets if s.visibility == visibility]
        if starred is not None:
            snippets = [s for s in snippets if s.starred == starred]
        if search:
            q = search.lower()
            snippets = [s for s in snippets if q in s.title.lower() or q in s.description.lower() or q in s.code.lower() or any(q in t for t in s.tags)]

        # Sort
        sort_funcs = {
            "updated_at": lambda s: s.updated_at,
            "created_at": lambda s: s.created_at,
            "usage_count": lambda s: s.usage_count,
            "title": lambda s: s.title.lower(),
            "copy_count": lambda s: s.copy_count,
        }
        sort_fn = sort_funcs.get(sort_by, sort_funcs["updated_at"])
        reverse = sort_by != "title"
        snippets.sort(key=sort_fn, reverse=reverse)

        total = len(snippets)
        snippets = snippets[offset:offset + limit]

        return {
            "items": [self._snippet_to_dict(s) for s in snippets],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_snippet(self, snippet_id: str) -> Optional[Dict[str, Any]]:
        snippet = self.snippets.get(snippet_id)
        if not snippet:
            return None
        snippet.view_count += 1
        return self._snippet_to_dict(snippet, include_code=True, include_versions=True, include_comments=True)

    def create_snippet(
        self,
        title: str,
        code: str,
        language: SnippetLanguage,
        description: str = "",
        folder: str = "Uncategorized",
        tags: Optional[List[str]] = None,
        visibility: SnippetVisibility = SnippetVisibility.PRIVATE,
        created_by: str = "system",
    ) -> Dict[str, Any]:
        snippet_id = f"snp_{uuid.uuid4().hex[:6]}"
        now = datetime.utcnow().isoformat() + "Z"

        snippet = Snippet(
            snippet_id=snippet_id, title=title, description=description,
            language=language, code=code, visibility=visibility,
            created_by=created_by, created_at=now, updated_at=now,
            folder=folder, tags=tags or [],
            line_count=code.count('\n') + 1,
            char_count=len(code),
            file_extension=self._get_extension(language),
        )

        snippet.versions.append(SnippetVersion(
            version_id=f"v_{snippet_id}_1", version_number=1,
            code=code, description="Initial version",
            created_at=now, created_by=created_by,
            line_count=snippet.line_count, char_count=snippet.char_count,
        ))

        self.snippets[snippet_id] = snippet
        self._index_snippet(snippet)
        return self._snippet_to_dict(snippet, include_code=True)

    def update_snippet(self, snippet_id: str, updates: Dict[str, Any], updated_by: str = "system") -> Optional[Dict[str, Any]]:
        snippet = self.snippets.get(snippet_id)
        if not snippet:
            return None

        if "code" in updates and updates["code"] != snippet.code:
            old_code = snippet.code
            snippet.code = updates["code"]
            snippet.line_count = snippet.code.count('\n') + 1
            snippet.char_count = len(snippet.code)

            new_version = SnippetVersion(
                version_id=f"v_{snippet_id}_{len(snippet.versions) + 1}",
                version_number=len(snippet.versions) + 1,
                code=snippet.code,
                description=updates.get("version_note", "Updated"),
                created_at=datetime.utcnow().isoformat() + "Z",
                created_by=updated_by,
                line_count=snippet.line_count,
                char_count=snippet.char_count,
            )
            snippet.versions.append(new_version)

        simple_fields = ["title", "description", "folder", "visibility"]
        for f in simple_fields:
            if f in updates:
                setattr(snippet, f, updates[f])

        if "tags" in updates:
            snippet.tags = updates["tags"]
            self._index_snippet(snippet)

        snippet.updated_at = datetime.utcnow().isoformat() + "Z"
        return self._snippet_to_dict(snippet, include_code=True)

    def delete_snippet(self, snippet_id: str) -> bool:
        snippet = self.snippets.pop(snippet_id, None)
        if not snippet:
            return False
        # Clean up indices
        for tag in snippet.tags:
            if tag in self._tag_index:
                self._tag_index[tag].discard(snippet_id)
        if snippet.language in self._language_index:
            self._language_index[snippet.language].discard(snippet_id)
        return True

    # ---- Actions ----

    def toggle_star(self, snippet_id: str) -> Optional[bool]:
        snippet = self.snippets.get(snippet_id)
        if not snippet:
            return None
        snippet.starred = not snippet.starred
        return snippet.starred

    def copy_snippet(self, snippet_id: str) -> Optional[str]:
        snippet = self.snippets.get(snippet_id)
        if not snippet:
            return None
        snippet.copy_count += 1
        snippet.usage_count += 1
        return snippet.code

    def add_comment(self, snippet_id: str, user_id: str, user_name: str, content: str, line_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        snippet = self.snippets.get(snippet_id)
        if not snippet:
            return None

        comment = SnippetComment(
            comment_id=f"cmt_{uuid.uuid4().hex[:6]}",
            user_id=user_id, user_name=user_name,
            content=content,
            created_at=datetime.utcnow().isoformat() + "Z",
            line_number=line_number,
        )
        snippet.comments.append(comment)
        return asdict(comment)

    def get_version(self, snippet_id: str, version_number: int) -> Optional[Dict[str, Any]]:
        snippet = self.snippets.get(snippet_id)
        if not snippet:
            return None
        for v in snippet.versions:
            if v.version_number == version_number:
                return asdict(v)
        return None

    # ---- Statistics ----

    def get_stats(self) -> Dict[str, Any]:
        all_snippets = list(self.snippets.values())
        total_lines = sum(s.line_count for s in all_snippets)
        total_chars = sum(s.char_count for s in all_snippets)

        return {
            "total_snippets": len(all_snippets),
            "total_lines": total_lines,
            "total_characters": total_chars,
            "starred": len([s for s in all_snippets if s.starred]),
            "total_copies": sum(s.copy_count for s in all_snippets),
            "total_views": sum(s.view_count for s in all_snippets),
            "by_language": {
                lang.value: len(ids)
                for lang, ids in self._language_index.items()
            },
            "by_folder": self._count_by_folder(all_snippets),
            "by_visibility": {
                v.value: len([s for s in all_snippets if s.visibility == v])
                for v in SnippetVisibility
            },
            "popular_tags": sorted(
                [{"tag": tag, "count": len(ids)} for tag, ids in self._tag_index.items()],
                key=lambda x: x["count"], reverse=True
            )[:20],
            "most_used": sorted(
                [{"id": s.snippet_id, "title": s.title, "usage_count": s.usage_count} for s in all_snippets],
                key=lambda x: x["usage_count"], reverse=True
            )[:10],
        }

    def list_folders(self) -> List[Dict[str, Any]]:
        """List all folders with snippet counts"""
        folder_counts: Dict[str, int] = {}
        for s in self.snippets.values():
            folder_counts[s.folder] = folder_counts.get(s.folder, 0) + 1

        result = []
        for fid, folder in self.folders.items():
            result.append({
                "id": fid,
                "name": folder.name,
                "snippet_count": folder_counts.get(folder.name, 0),
                "color": folder.color,
                "icon": folder.icon,
            })
        return result

    def list_tags(self) -> List[Dict[str, int]]:
        """List all tags with counts"""
        return sorted(
            [{"tag": tag, "count": len(ids)} for tag, ids in self._tag_index.items()],
            key=lambda x: x["count"], reverse=True
        )

    # ---- Helpers ----

    @staticmethod
    def _count_by_folder(snippets: List[Snippet]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for s in snippets:
            counts[s.folder] = counts.get(s.folder, 0) + 1
        return counts

    @staticmethod
    def _get_extension(language: SnippetLanguage) -> str:
        ext_map = {
            SnippetLanguage.PYTHON: ".py", SnippetLanguage.TYPESCRIPT: ".ts",
            SnippetLanguage.JAVASCRIPT: ".js", SnippetLanguage.RUST: ".rs",
            SnippetLanguage.GO: ".go", SnippetLanguage.JAVA: ".java",
            SnippetLanguage.CPP: ".cpp", SnippetLanguage.C: ".c",
            SnippetLanguage.CSHARP: ".cs", SnippetLanguage.RUBY: ".rb",
            SnippetLanguage.PHP: ".php", SnippetLanguage.SWIFT: ".swift",
            SnippetLanguage.KOTLIN: ".kt", SnippetLanguage.SQL: ".sql",
            SnippetLanguage.BASH: ".sh", SnippetLanguage.YAML: ".yml",
            SnippetLanguage.JSON: ".json", SnippetLanguage.HTML: ".html",
            SnippetLanguage.CSS: ".css", SnippetLanguage.MARKDOWN: ".md",
            SnippetLanguage.DOCKERFILE: "Dockerfile",
        }
        return ext_map.get(language, ".txt")

    def _snippet_to_dict(self, s: Snippet, include_code: bool = False, include_versions: bool = False, include_comments: bool = False) -> Dict[str, Any]:
        result = {
            "snippet_id": s.snippet_id,
            "title": s.title,
            "description": s.description,
            "language": s.language.value,
            "visibility": s.visibility.value,
            "folder": s.folder,
            "tags": s.tags,
            "starred": s.starred,
            "pinned": s.pinned,
            "usage_count": s.usage_count,
            "copy_count": s.copy_count,
            "view_count": s.view_count,
            "line_count": s.line_count,
            "char_count": s.char_count,
            "file_extension": s.file_extension,
            "current_version": s.current_version,
            "checksum": s.checksum,
            "created_by": s.created_by,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
            "comment_count": len(s.comments),
        }
        if include_code:
            result["code"] = s.code
        if include_versions:
            result["versions"] = [asdict(v) for v in s.versions]
        if include_comments:
            result["comments"] = [asdict(c) for c in s.comments]
        return result


# Singleton instance
_snippet_service: Optional[SnippetService] = None


def get_snippet_service() -> SnippetService:
    global _snippet_service
    if _snippet_service is None:
        _snippet_service = SnippetService()
    return _snippet_service
