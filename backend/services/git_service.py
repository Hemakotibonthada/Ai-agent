"""
Git Repository Management Service for Nexus AI
Full Git operations, branch management, commit history, and CI/CD integration
"""

import asyncio
import hashlib
import json
import os
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
from services.demo_data_manager import is_demo_data_enabled


class GitProvider(str, Enum):
    GITHUB = "github"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"
    AZURE_DEVOPS = "azure_devops"
    GITEA = "gitea"
    LOCAL = "local"


class BranchProtection(str, Enum):
    NONE = "none"
    REQUIRE_PR = "require_pr"
    REQUIRE_REVIEW = "require_review"
    REQUIRE_CI = "require_ci"
    REQUIRE_ALL = "require_all"


class MergeStrategy(str, Enum):
    MERGE = "merge"
    SQUASH = "squash"
    REBASE = "rebase"
    FAST_FORWARD = "fast_forward"


class ConflictResolution(str, Enum):
    OURS = "ours"
    THEIRS = "theirs"
    MANUAL = "manual"
    AUTO = "auto"


class CIStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class PRStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    MERGED = "merged"
    DRAFT = "draft"


@dataclass
class GitCommit:
    sha: str
    message: str
    author: str
    author_email: str
    timestamp: datetime
    parent_shas: List[str] = field(default_factory=list)
    files_changed: int = 0
    insertions: int = 0
    deletions: int = 0
    branch: str = "main"
    tags: List[str] = field(default_factory=list)
    gpg_signed: bool = False
    co_authors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        return d


@dataclass
class GitBranch:
    name: str
    head_sha: str
    upstream: Optional[str] = None
    is_default: bool = False
    is_protected: bool = False
    protection_level: BranchProtection = BranchProtection.NONE
    ahead: int = 0
    behind: int = 0
    last_commit_date: Optional[datetime] = None
    author: str = ""

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.last_commit_date:
            d["last_commit_date"] = self.last_commit_date.isoformat()
        return d


@dataclass
class GitTag:
    name: str
    sha: str
    message: str = ""
    tagger: str = ""
    date: Optional[datetime] = None
    is_annotated: bool = False
    is_release: bool = False

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.date:
            d["date"] = self.date.isoformat()
        return d


@dataclass
class PullRequest:
    id: str
    number: int
    title: str
    description: str
    source_branch: str
    target_branch: str
    author: str
    status: PRStatus = PRStatus.OPEN
    reviewers: List[str] = field(default_factory=list)
    labels: List[str] = field(default_factory=list)
    ci_status: CIStatus = CIStatus.PENDING
    merge_strategy: MergeStrategy = MergeStrategy.SQUASH
    conflicts: bool = False
    comments_count: int = 0
    approvals: int = 0
    required_approvals: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    merged_at: Optional[datetime] = None
    files_changed: int = 0
    insertions: int = 0
    deletions: int = 0

    def to_dict(self) -> Dict:
        d = asdict(self)
        for k in ["created_at", "updated_at", "merged_at"]:
            if d[k]:
                d[k] = d[k].isoformat() if isinstance(d[k], datetime) else d[k]
        return d


@dataclass
class GitRepository:
    id: str
    name: str
    url: str
    provider: GitProvider
    default_branch: str = "main"
    description: str = ""
    is_private: bool = True
    stars: int = 0
    forks: int = 0
    open_issues: int = 0
    open_prs: int = 0
    last_push: Optional[datetime] = None
    size_kb: int = 0
    languages: Dict[str, float] = field(default_factory=dict)
    topics: List[str] = field(default_factory=list)
    ci_enabled: bool = True
    webhook_url: Optional[str] = None
    deploy_key: Optional[str] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.last_push:
            d["last_push"] = self.last_push.isoformat()
        return d


@dataclass
class DiffHunk:
    old_start: int
    old_count: int
    new_start: int
    new_count: int
    header: str = ""
    lines: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class FileDiff:
    path: str
    old_path: Optional[str] = None
    status: str = "modified"
    insertions: int = 0
    deletions: int = 0
    is_binary: bool = False
    hunks: List[DiffHunk] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class GitStash:
    index: int
    message: str
    branch: str
    timestamp: datetime
    files_count: int = 0

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        return d


@dataclass
class GitHook:
    name: str
    path: str
    is_active: bool = True
    script: str = ""
    last_run: Optional[datetime] = None
    last_status: str = "unknown"


@dataclass
class CIPipeline:
    id: str
    name: str
    status: CIStatus
    branch: str
    commit_sha: str
    trigger: str = "push"
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_seconds: int = 0
    stages: List[Dict[str, Any]] = field(default_factory=list)
    artifacts: List[str] = field(default_factory=list)
    logs_url: str = ""
    coverage: float = 0.0

    def to_dict(self) -> Dict:
        d = asdict(self)
        for k in ["started_at", "finished_at"]:
            if d[k]:
                d[k] = d[k].isoformat() if isinstance(d[k], datetime) else d[k]
        return d


class GitService:
    """Comprehensive Git repository management service"""

    def __init__(self):
        self.repositories: Dict[str, GitRepository] = {}
        self.commits: Dict[str, List[GitCommit]] = {}
        self.branches: Dict[str, List[GitBranch]] = {}
        self.tags: Dict[str, List[GitTag]] = {}
        self.pull_requests: Dict[str, List[PullRequest]] = {}
        self.stashes: Dict[str, List[GitStash]] = {}
        self.pipelines: Dict[str, List[CIPipeline]] = {}
        self.hooks: Dict[str, List[GitHook]] = {}
        self.webhooks: Dict[str, List[Dict]] = {}
        self._event_handlers: Dict[str, List] = {}
        self._initialized = False

    async def initialize(self):
        """Initialize the Git service with default repositories"""
        if self._initialized:
            return

        # Create sample repositories
        if is_demo_data_enabled():
            await self._create_sample_data()
        self._initialized = True

    async def _create_sample_data(self):
        """Create sample repository data"""
        repos = [
            GitRepository(
                id="repo-001",
                name="nexus-ai-core",
                url="https://github.com/nexus-ai/core",
                provider=GitProvider.GITHUB,
                default_branch="main",
                description="Core AI engine and orchestration layer",
                is_private=True,
                stars=342,
                forks=45,
                open_issues=12,
                open_prs=5,
                last_push=datetime.now() - timedelta(hours=2),
                size_kb=15420,
                languages={"Python": 68.5, "TypeScript": 24.3, "Shell": 5.2, "Docker": 2.0},
                topics=["ai", "machine-learning", "agents", "python"],
                ci_enabled=True,
            ),
            GitRepository(
                id="repo-002",
                name="nexus-frontend",
                url="https://github.com/nexus-ai/frontend",
                provider=GitProvider.GITHUB,
                default_branch="main",
                description="React-based dashboard and control panel",
                is_private=True,
                stars=128,
                forks=18,
                open_issues=8,
                open_prs=3,
                last_push=datetime.now() - timedelta(hours=1),
                size_kb=8920,
                languages={"TypeScript": 82.1, "CSS": 12.4, "HTML": 3.5, "JavaScript": 2.0},
                topics=["react", "typescript", "dashboard", "ui"],
                ci_enabled=True,
            ),
            GitRepository(
                id="repo-003",
                name="nexus-ml-models",
                url="https://github.com/nexus-ai/ml-models",
                provider=GitProvider.GITHUB,
                default_branch="main",
                description="Machine learning models and training pipelines",
                is_private=True,
                stars=89,
                forks=12,
                open_issues=5,
                open_prs=2,
                last_push=datetime.now() - timedelta(days=1),
                size_kb=245000,
                languages={"Python": 91.2, "Jupyter": 6.8, "Shell": 2.0},
                topics=["ml", "deep-learning", "pytorch", "transformers"],
                ci_enabled=True,
            ),
            GitRepository(
                id="repo-004",
                name="nexus-infra",
                url="https://gitlab.com/nexus-ai/infra",
                provider=GitProvider.GITLAB,
                default_branch="main",
                description="Infrastructure as code and deployment configs",
                is_private=True,
                stars=34,
                forks=5,
                open_issues=3,
                open_prs=1,
                last_push=datetime.now() - timedelta(days=3),
                size_kb=2340,
                languages={"HCL": 48.5, "YAML": 32.1, "Shell": 15.4, "Python": 4.0},
                topics=["terraform", "kubernetes", "infrastructure", "devops"],
                ci_enabled=True,
            ),
        ]

        for repo in repos:
            self.repositories[repo.id] = repo
            await self._generate_commits(repo.id)
            await self._generate_branches(repo.id)
            await self._generate_tags(repo.id)
            await self._generate_prs(repo.id)
            await self._generate_pipelines(repo.id)

    async def _generate_commits(self, repo_id: str):
        """Generate sample commit history"""
        authors = [
            ("Alice Chen", "alice@nexus.ai"),
            ("Bob Smith", "bob@nexus.ai"),
            ("Carol Davis", "carol@nexus.ai"),
            ("David Kim", "david@nexus.ai"),
            ("Eve Johnson", "eve@nexus.ai"),
        ]
        messages = [
            "feat: implement real-time agent communication protocol",
            "fix: resolve memory leak in websocket connection pool",
            "refactor: optimize database query performance by 40%",
            "docs: update API documentation for v2 endpoints",
            "test: add integration tests for auth service",
            "feat: add multi-modal input processing pipeline",
            "fix: handle edge case in token refresh logic",
            "chore: upgrade dependencies to latest versions",
            "feat: implement semantic search with vector embeddings",
            "perf: reduce cold start time from 3s to 800ms",
            "feat: add support for custom AI model fine-tuning",
            "fix: correct timezone handling in scheduler",
            "refactor: split monolithic agent into microservices",
            "feat: implement incremental backup with deduplication",
            "security: patch CVE-2025-1234 in auth middleware",
            "feat: add natural language query interface",
            "fix: resolve race condition in concurrent task execution",
            "docs: add architecture decision records",
            "feat: implement plugin sandboxed execution environment",
            "perf: add response caching with intelligent invalidation",
        ]

        commits = []
        for i in range(20):
            author = authors[i % len(authors)]
            sha = hashlib.sha1(f"{repo_id}-{i}".encode()).hexdigest()
            parent_sha = hashlib.sha1(f"{repo_id}-{i-1}".encode()).hexdigest() if i > 0 else ""
            commits.append(GitCommit(
                sha=sha,
                message=messages[i % len(messages)],
                author=author[0],
                author_email=author[1],
                timestamp=datetime.now() - timedelta(hours=i * 4),
                parent_shas=[parent_sha] if parent_sha else [],
                files_changed=max(1, (i * 3) % 15),
                insertions=max(5, (i * 47) % 500),
                deletions=max(0, (i * 23) % 200),
                branch="main" if i % 3 == 0 else "develop",
                gpg_signed=i % 2 == 0,
            ))

        self.commits[repo_id] = commits

    async def _generate_branches(self, repo_id: str):
        """Generate sample branches"""
        branches = [
            GitBranch(name="main", head_sha="abc123", is_default=True, is_protected=True,
                      protection_level=BranchProtection.REQUIRE_ALL, author="system"),
            GitBranch(name="develop", head_sha="def456", upstream="origin/develop",
                      ahead=3, behind=0, author="Alice Chen",
                      last_commit_date=datetime.now() - timedelta(hours=1)),
            GitBranch(name="feature/agent-v2", head_sha="ghi789", upstream="origin/feature/agent-v2",
                      ahead=12, behind=2, author="Bob Smith",
                      last_commit_date=datetime.now() - timedelta(hours=6)),
            GitBranch(name="feature/ml-pipeline", head_sha="jkl012", upstream="origin/feature/ml-pipeline",
                      ahead=8, behind=5, author="Carol Davis",
                      last_commit_date=datetime.now() - timedelta(days=1)),
            GitBranch(name="hotfix/auth-bypass", head_sha="mno345",
                      is_protected=True, protection_level=BranchProtection.REQUIRE_REVIEW,
                      ahead=1, behind=0, author="Eve Johnson",
                      last_commit_date=datetime.now() - timedelta(hours=3)),
            GitBranch(name="release/v2.5.0", head_sha="pqr678",
                      is_protected=True, protection_level=BranchProtection.REQUIRE_CI,
                      ahead=0, behind=15, author="David Kim",
                      last_commit_date=datetime.now() - timedelta(days=2)),
        ]
        self.branches[repo_id] = branches

    async def _generate_tags(self, repo_id: str):
        """Generate sample tags"""
        tags = [
            GitTag(name="v2.5.0", sha="aaa111", message="Release 2.5.0 - Multi-agent orchestration",
                   tagger="Alice Chen", date=datetime.now() - timedelta(days=7), is_annotated=True, is_release=True),
            GitTag(name="v2.4.1", sha="bbb222", message="Hotfix: Auth token refresh",
                   tagger="Bob Smith", date=datetime.now() - timedelta(days=14), is_annotated=True, is_release=True),
            GitTag(name="v2.4.0", sha="ccc333", message="Release 2.4.0 - Vector search",
                   tagger="Carol Davis", date=datetime.now() - timedelta(days=30), is_annotated=True, is_release=True),
            GitTag(name="v2.3.0", sha="ddd444", message="Release 2.3.0 - Plugin system",
                   tagger="David Kim", date=datetime.now() - timedelta(days=60), is_annotated=True, is_release=True),
        ]
        self.tags[repo_id] = tags

    async def _generate_prs(self, repo_id: str):
        """Generate sample pull requests"""
        prs = [
            PullRequest(
                id=f"pr-{repo_id}-1", number=142, title="feat: Implement agent collaboration protocol",
                description="This PR adds the ability for agents to collaborate on complex tasks using a shared context protocol.",
                source_branch="feature/agent-v2", target_branch="develop",
                author="Bob Smith", status=PRStatus.OPEN,
                reviewers=["Alice Chen", "Carol Davis"], labels=["feature", "agents"],
                ci_status=CIStatus.SUCCESS, approvals=1, required_approvals=2,
                created_at=datetime.now() - timedelta(days=2), files_changed=24, insertions=1840, deletions=320,
            ),
            PullRequest(
                id=f"pr-{repo_id}-2", number=141, title="fix: Resolve OOM in large context windows",
                description="Fixes memory overflow when processing context windows > 128k tokens.",
                source_branch="fix/oom-context", target_branch="main",
                author="Carol Davis", status=PRStatus.OPEN,
                reviewers=["Eve Johnson"], labels=["bug", "critical"],
                ci_status=CIStatus.RUNNING, approvals=0, required_approvals=1,
                created_at=datetime.now() - timedelta(days=1), files_changed=8, insertions=245, deletions=89,
            ),
            PullRequest(
                id=f"pr-{repo_id}-3", number=140, title="refactor: Migrate to async database driver",
                description="Migrates all database operations from synchronous to async using asyncpg.",
                source_branch="refactor/async-db", target_branch="develop",
                author="David Kim", status=PRStatus.MERGED,
                reviewers=["Alice Chen", "Bob Smith"], labels=["refactor", "performance"],
                ci_status=CIStatus.SUCCESS, approvals=2, required_approvals=2,
                created_at=datetime.now() - timedelta(days=5),
                merged_at=datetime.now() - timedelta(days=3),
                files_changed=45, insertions=3200, deletions=2800,
            ),
            PullRequest(
                id=f"pr-{repo_id}-4", number=139, title="docs: Add comprehensive API reference",
                description="Complete API reference documentation with examples for all endpoints.",
                source_branch="docs/api-reference", target_branch="main",
                author="Eve Johnson", status=PRStatus.MERGED,
                reviewers=["Alice Chen"], labels=["documentation"],
                ci_status=CIStatus.SUCCESS, approvals=1, required_approvals=1,
                created_at=datetime.now() - timedelta(days=7),
                merged_at=datetime.now() - timedelta(days=6),
                files_changed=12, insertions=2400, deletions=150,
            ),
        ]
        self.pull_requests[repo_id] = prs

    async def _generate_pipelines(self, repo_id: str):
        """Generate sample CI/CD pipelines"""
        pipelines = [
            CIPipeline(
                id=f"pipe-{repo_id}-1", name="Build & Test", status=CIStatus.SUCCESS,
                branch="main", commit_sha="abc123", trigger="push",
                started_at=datetime.now() - timedelta(hours=1),
                finished_at=datetime.now() - timedelta(minutes=45),
                duration_seconds=900,
                stages=[
                    {"name": "lint", "status": "success", "duration": 45},
                    {"name": "test", "status": "success", "duration": 320},
                    {"name": "build", "status": "success", "duration": 180},
                    {"name": "security-scan", "status": "success", "duration": 120},
                    {"name": "deploy-staging", "status": "success", "duration": 235},
                ],
                coverage=87.4,
            ),
            CIPipeline(
                id=f"pipe-{repo_id}-2", name="Deploy Production", status=CIStatus.RUNNING,
                branch="release/v2.5.0", commit_sha="pqr678", trigger="manual",
                started_at=datetime.now() - timedelta(minutes=15),
                duration_seconds=900,
                stages=[
                    {"name": "build", "status": "success", "duration": 180},
                    {"name": "integration-test", "status": "success", "duration": 450},
                    {"name": "staging-deploy", "status": "success", "duration": 120},
                    {"name": "smoke-test", "status": "running", "duration": 0},
                    {"name": "prod-deploy", "status": "pending", "duration": 0},
                    {"name": "health-check", "status": "pending", "duration": 0},
                ],
                coverage=87.4,
            ),
            CIPipeline(
                id=f"pipe-{repo_id}-3", name="Nightly Build", status=CIStatus.FAILURE,
                branch="develop", commit_sha="def456", trigger="schedule",
                started_at=datetime.now() - timedelta(hours=8),
                finished_at=datetime.now() - timedelta(hours=7, minutes=30),
                duration_seconds=1800,
                stages=[
                    {"name": "lint", "status": "success", "duration": 45},
                    {"name": "unit-test", "status": "success", "duration": 480},
                    {"name": "integration-test", "status": "failure", "duration": 920},
                    {"name": "e2e-test", "status": "skipped", "duration": 0},
                ],
                coverage=82.1,
            ),
        ]
        self.pipelines[repo_id] = pipelines

    # Repository Operations
    async def list_repositories(self, provider: Optional[GitProvider] = None) -> List[Dict]:
        """List all repositories, optionally filtered by provider"""
        repos = list(self.repositories.values())
        if provider:
            repos = [r for r in repos if r.provider == provider]
        return [r.to_dict() for r in repos]

    async def get_repository(self, repo_id: str) -> Optional[Dict]:
        """Get repository details"""
        repo = self.repositories.get(repo_id)
        return repo.to_dict() if repo else None

    async def create_repository(self, name: str, provider: GitProvider, description: str = "",
                                is_private: bool = True, default_branch: str = "main") -> Dict:
        """Create a new repository"""
        repo_id = f"repo-{hashlib.md5(name.encode()).hexdigest()[:8]}"
        repo = GitRepository(
            id=repo_id, name=name, url=f"https://github.com/nexus-ai/{name}",
            provider=provider, default_branch=default_branch,
            description=description, is_private=is_private,
            last_push=datetime.now(),
        )
        self.repositories[repo_id] = repo
        self.commits[repo_id] = []
        self.branches[repo_id] = [
            GitBranch(name=default_branch, head_sha="initial", is_default=True)
        ]
        self.tags[repo_id] = []
        self.pull_requests[repo_id] = []
        await self._emit_event("repo_created", repo.to_dict())
        return repo.to_dict()

    async def delete_repository(self, repo_id: str) -> bool:
        """Delete a repository"""
        if repo_id in self.repositories:
            del self.repositories[repo_id]
            self.commits.pop(repo_id, None)
            self.branches.pop(repo_id, None)
            self.tags.pop(repo_id, None)
            self.pull_requests.pop(repo_id, None)
            await self._emit_event("repo_deleted", {"repo_id": repo_id})
            return True
        return False

    # Branch Operations
    async def list_branches(self, repo_id: str) -> List[Dict]:
        """List all branches for a repository"""
        branches = self.branches.get(repo_id, [])
        return [b.to_dict() for b in branches]

    async def create_branch(self, repo_id: str, name: str, from_branch: str = "main",
                            protection: BranchProtection = BranchProtection.NONE) -> Optional[Dict]:
        """Create a new branch"""
        if repo_id not in self.branches:
            return None

        source = next((b for b in self.branches[repo_id] if b.name == from_branch), None)
        if not source:
            return None

        branch = GitBranch(
            name=name, head_sha=source.head_sha,
            upstream=f"origin/{name}",
            is_protected=protection != BranchProtection.NONE,
            protection_level=protection,
            last_commit_date=datetime.now(),
        )
        self.branches[repo_id].append(branch)
        await self._emit_event("branch_created", {"repo_id": repo_id, "branch": branch.to_dict()})
        return branch.to_dict()

    async def delete_branch(self, repo_id: str, name: str) -> bool:
        """Delete a branch"""
        if repo_id not in self.branches:
            return False

        branch = next((b for b in self.branches[repo_id] if b.name == name), None)
        if not branch or branch.is_default or branch.is_protected:
            return False

        self.branches[repo_id] = [b for b in self.branches[repo_id] if b.name != name]
        await self._emit_event("branch_deleted", {"repo_id": repo_id, "branch": name})
        return True

    async def merge_branches(self, repo_id: str, source: str, target: str,
                             strategy: MergeStrategy = MergeStrategy.SQUASH,
                             message: str = "") -> Dict:
        """Merge source branch into target"""
        merge_sha = hashlib.sha1(f"merge-{source}-{target}".encode()).hexdigest()
        result = {
            "merge_sha": merge_sha,
            "source": source,
            "target": target,
            "strategy": strategy.value,
            "message": message or f"Merge '{source}' into '{target}'",
            "conflicts": False,
            "files_changed": 15,
            "timestamp": datetime.now().isoformat(),
        }
        await self._emit_event("branch_merged", result)
        return result

    # Commit Operations
    async def list_commits(self, repo_id: str, branch: Optional[str] = None,
                           author: Optional[str] = None, limit: int = 20) -> List[Dict]:
        """List commits with optional filters"""
        commits = self.commits.get(repo_id, [])
        if branch:
            commits = [c for c in commits if c.branch == branch]
        if author:
            commits = [c for c in commits if author.lower() in c.author.lower()]
        return [c.to_dict() for c in commits[:limit]]

    async def get_commit(self, repo_id: str, sha: str) -> Optional[Dict]:
        """Get commit details"""
        commits = self.commits.get(repo_id, [])
        commit = next((c for c in commits if c.sha.startswith(sha)), None)
        return commit.to_dict() if commit else None

    async def get_commit_diff(self, repo_id: str, sha: str) -> List[Dict]:
        """Get diff for a specific commit"""
        return [
            FileDiff(
                path="backend/agents/orchestrator.py",
                status="modified", insertions=24, deletions=8,
                hunks=[DiffHunk(old_start=45, old_count=10, new_start=45, new_count=16,
                                header="class Orchestrator:")]
            ).to_dict(),
            FileDiff(
                path="backend/services/ai_service.py",
                status="modified", insertions=12, deletions=3,
                hunks=[DiffHunk(old_start=102, old_count=5, new_start=102, new_count=14,
                                header="async def process_request")]
            ).to_dict(),
            FileDiff(
                path="tests/test_orchestrator.py",
                status="added", insertions=85, deletions=0,
                hunks=[DiffHunk(old_start=0, old_count=0, new_start=1, new_count=85,
                                header="")]
            ).to_dict(),
        ]

    async def cherry_pick(self, repo_id: str, sha: str, target_branch: str) -> Dict:
        """Cherry-pick a commit to another branch"""
        new_sha = hashlib.sha1(f"cherry-{sha}-{target_branch}".encode()).hexdigest()
        return {
            "original_sha": sha,
            "new_sha": new_sha,
            "target_branch": target_branch,
            "conflicts": False,
            "timestamp": datetime.now().isoformat(),
        }

    async def revert_commit(self, repo_id: str, sha: str) -> Dict:
        """Revert a specific commit"""
        revert_sha = hashlib.sha1(f"revert-{sha}".encode()).hexdigest()
        return {
            "reverted_sha": sha,
            "revert_sha": revert_sha,
            "message": f"Revert: {sha[:8]}",
            "timestamp": datetime.now().isoformat(),
        }

    # Tag Operations
    async def list_tags(self, repo_id: str) -> List[Dict]:
        """List all tags"""
        tags = self.tags.get(repo_id, [])
        return [t.to_dict() for t in tags]

    async def create_tag(self, repo_id: str, name: str, sha: str,
                         message: str = "", is_release: bool = False) -> Dict:
        """Create a new tag"""
        tag = GitTag(
            name=name, sha=sha, message=message,
            tagger="system", date=datetime.now(),
            is_annotated=bool(message), is_release=is_release,
        )
        if repo_id not in self.tags:
            self.tags[repo_id] = []
        self.tags[repo_id].insert(0, tag)
        await self._emit_event("tag_created", tag.to_dict())
        return tag.to_dict()

    # Pull Request Operations
    async def list_pull_requests(self, repo_id: str, status: Optional[PRStatus] = None) -> List[Dict]:
        """List pull requests"""
        prs = self.pull_requests.get(repo_id, [])
        if status:
            prs = [pr for pr in prs if pr.status == status]
        return [pr.to_dict() for pr in prs]

    async def get_pull_request(self, repo_id: str, pr_number: int) -> Optional[Dict]:
        """Get pull request details"""
        prs = self.pull_requests.get(repo_id, [])
        pr = next((p for p in prs if p.number == pr_number), None)
        return pr.to_dict() if pr else None

    async def create_pull_request(self, repo_id: str, title: str, source_branch: str,
                                  target_branch: str, description: str = "",
                                  reviewers: List[str] = None) -> Dict:
        """Create a new pull request"""
        prs = self.pull_requests.get(repo_id, [])
        number = max([p.number for p in prs], default=0) + 1
        pr = PullRequest(
            id=f"pr-{repo_id}-{number}", number=number,
            title=title, description=description,
            source_branch=source_branch, target_branch=target_branch,
            author="current_user", status=PRStatus.OPEN,
            reviewers=reviewers or [], ci_status=CIStatus.PENDING,
            created_at=datetime.now(),
        )
        if repo_id not in self.pull_requests:
            self.pull_requests[repo_id] = []
        self.pull_requests[repo_id].insert(0, pr)
        await self._emit_event("pr_created", pr.to_dict())
        return pr.to_dict()

    async def merge_pull_request(self, repo_id: str, pr_number: int,
                                 strategy: MergeStrategy = MergeStrategy.SQUASH) -> Dict:
        """Merge a pull request"""
        prs = self.pull_requests.get(repo_id, [])
        pr = next((p for p in prs if p.number == pr_number), None)
        if not pr:
            return {"error": "PR not found"}
        pr.status = PRStatus.MERGED
        pr.merged_at = datetime.now()
        pr.merge_strategy = strategy
        await self._emit_event("pr_merged", pr.to_dict())
        return pr.to_dict()

    # CI/CD Pipeline Operations
    async def list_pipelines(self, repo_id: str,
                             status: Optional[CIStatus] = None) -> List[Dict]:
        """List CI/CD pipelines"""
        pipelines = self.pipelines.get(repo_id, [])
        if status:
            pipelines = [p for p in pipelines if p.status == status]
        return [p.to_dict() for p in pipelines]

    async def trigger_pipeline(self, repo_id: str, branch: str, name: str = "Manual Build") -> Dict:
        """Trigger a CI/CD pipeline"""
        pipe_id = f"pipe-{repo_id}-{len(self.pipelines.get(repo_id, [])) + 1}"
        pipeline = CIPipeline(
            id=pipe_id, name=name, status=CIStatus.RUNNING,
            branch=branch, commit_sha=hashlib.sha1(branch.encode()).hexdigest()[:12],
            trigger="manual", started_at=datetime.now(),
            stages=[
                {"name": "build", "status": "running", "duration": 0},
                {"name": "test", "status": "pending", "duration": 0},
                {"name": "deploy", "status": "pending", "duration": 0},
            ],
        )
        if repo_id not in self.pipelines:
            self.pipelines[repo_id] = []
        self.pipelines[repo_id].insert(0, pipeline)
        await self._emit_event("pipeline_triggered", pipeline.to_dict())
        return pipeline.to_dict()

    async def cancel_pipeline(self, repo_id: str, pipeline_id: str) -> bool:
        """Cancel a running pipeline"""
        pipelines = self.pipelines.get(repo_id, [])
        pipeline = next((p for p in pipelines if p.id == pipeline_id), None)
        if pipeline and pipeline.status == CIStatus.RUNNING:
            pipeline.status = CIStatus.CANCELLED
            pipeline.finished_at = datetime.now()
            return True
        return False

    # Statistics & Analytics
    async def get_repo_stats(self, repo_id: str) -> Dict:
        """Get repository statistics"""
        commits = self.commits.get(repo_id, [])
        prs = self.pull_requests.get(repo_id, [])
        branches = self.branches.get(repo_id, [])

        total_insertions = sum(c.insertions for c in commits)
        total_deletions = sum(c.deletions for c in commits)

        # Contribution by author
        author_stats = {}
        for c in commits:
            if c.author not in author_stats:
                author_stats[c.author] = {"commits": 0, "insertions": 0, "deletions": 0}
            author_stats[c.author]["commits"] += 1
            author_stats[c.author]["insertions"] += c.insertions
            author_stats[c.author]["deletions"] += c.deletions

        return {
            "total_commits": len(commits),
            "total_branches": len(branches),
            "total_prs": len(prs),
            "open_prs": len([p for p in prs if p.status == PRStatus.OPEN]),
            "merged_prs": len([p for p in prs if p.status == PRStatus.MERGED]),
            "total_insertions": total_insertions,
            "total_deletions": total_deletions,
            "active_contributors": len(author_stats),
            "author_stats": author_stats,
            "languages": self.repositories[repo_id].languages if repo_id in self.repositories else {},
            "commit_frequency": {
                "daily_avg": len(commits) / max(1, 7),
                "weekly_total": len(commits),
            },
        }

    async def get_code_frequency(self, repo_id: str) -> List[Dict]:
        """Get code frequency data (insertions/deletions over time)"""
        commits = self.commits.get(repo_id, [])
        frequency = []
        for c in commits:
            frequency.append({
                "date": c.timestamp.strftime("%Y-%m-%d"),
                "insertions": c.insertions,
                "deletions": -c.deletions,
                "net": c.insertions - c.deletions,
            })
        return frequency

    # Stash Operations
    async def list_stashes(self, repo_id: str) -> List[Dict]:
        """List stashed changes"""
        stashes = self.stashes.get(repo_id, [])
        return [s.to_dict() for s in stashes]

    async def create_stash(self, repo_id: str, message: str = "WIP") -> Dict:
        """Create a stash"""
        stashes = self.stashes.get(repo_id, [])
        stash = GitStash(
            index=len(stashes),
            message=message,
            branch="current",
            timestamp=datetime.now(),
            files_count=5,
        )
        if repo_id not in self.stashes:
            self.stashes[repo_id] = []
        self.stashes[repo_id].insert(0, stash)
        return stash.to_dict()

    async def apply_stash(self, repo_id: str, index: int) -> bool:
        """Apply a stash"""
        stashes = self.stashes.get(repo_id, [])
        stash = next((s for s in stashes if s.index == index), None)
        if stash:
            self.stashes[repo_id] = [s for s in stashes if s.index != index]
            return True
        return False

    # Event System
    async def _emit_event(self, event_type: str, data: Any):
        """Emit an event to registered handlers"""
        handlers = self._event_handlers.get(event_type, [])
        for handler in handlers:
            try:
                await handler(data)
            except Exception:
                pass

    def on_event(self, event_type: str, handler):
        """Register an event handler"""
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)

    # Blame & History
    async def get_file_blame(self, repo_id: str, file_path: str) -> List[Dict]:
        """Get blame information for a file"""
        commits = self.commits.get(repo_id, [])[:5]
        blame_lines = []
        for i, commit in enumerate(commits):
            blame_lines.append({
                "line_start": i * 20 + 1,
                "line_end": (i + 1) * 20,
                "sha": commit.sha[:8],
                "author": commit.author,
                "date": commit.timestamp.isoformat(),
                "message": commit.message,
            })
        return blame_lines

    async def get_file_history(self, repo_id: str, file_path: str) -> List[Dict]:
        """Get commit history for a specific file"""
        commits = self.commits.get(repo_id, [])[:10]
        return [
            {
                "sha": c.sha[:8],
                "author": c.author,
                "date": c.timestamp.isoformat(),
                "message": c.message,
                "insertions": c.insertions,
                "deletions": c.deletions,
            }
            for c in commits
        ]

    # Webhooks
    async def list_webhooks(self, repo_id: str) -> List[Dict]:
        """List repository webhooks"""
        return self.webhooks.get(repo_id, [])

    async def create_webhook(self, repo_id: str, url: str, events: List[str],
                             secret: str = "") -> Dict:
        """Create a repository webhook"""
        webhook = {
            "id": hashlib.md5(url.encode()).hexdigest()[:8],
            "url": url,
            "events": events,
            "secret": secret,
            "active": True,
            "created_at": datetime.now().isoformat(),
            "last_delivery": None,
            "success_count": 0,
            "failure_count": 0,
        }
        if repo_id not in self.webhooks:
            self.webhooks[repo_id] = []
        self.webhooks[repo_id].append(webhook)
        return webhook

    async def get_summary(self) -> Dict:
        """Get overall git service summary"""
        total_repos = len(self.repositories)
        total_commits = sum(len(c) for c in self.commits.values())
        total_branches = sum(len(b) for b in self.branches.values())
        total_prs = sum(len(p) for p in self.pull_requests.values())
        open_prs = sum(
            len([p for p in prs if p.status == PRStatus.OPEN])
            for prs in self.pull_requests.values()
        )

        return {
            "total_repositories": total_repos,
            "total_commits": total_commits,
            "total_branches": total_branches,
            "total_pull_requests": total_prs,
            "open_pull_requests": open_prs,
            "providers": list(set(r.provider.value for r in self.repositories.values())),
            "total_contributors": len(set(
                c.author for commits in self.commits.values() for c in commits
            )),
        }
