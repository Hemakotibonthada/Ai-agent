"""
Git Repository Management API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/git", tags=["git"])


class GitProviderEnum(str, Enum):
    github = "github"
    gitlab = "gitlab"
    bitbucket = "bitbucket"
    azure_devops = "azure_devops"
    gitea = "gitea"
    local = "local"


class PRStatusEnum(str, Enum):
    open = "open"
    closed = "closed"
    merged = "merged"
    draft = "draft"


class MergeStrategyEnum(str, Enum):
    merge = "merge"
    squash = "squash"
    rebase = "rebase"


class CreateRepoRequest(BaseModel):
    name: str
    provider: GitProviderEnum = GitProviderEnum.github
    description: str = ""
    is_private: bool = True
    default_branch: str = "main"


class CreateBranchRequest(BaseModel):
    name: str
    from_branch: str = "main"


class CreatePRRequest(BaseModel):
    title: str
    source_branch: str
    target_branch: str
    description: str = ""
    reviewers: list[str] = []


class CreateTagRequest(BaseModel):
    name: str
    sha: str
    message: str = ""
    is_release: bool = False


class MergeBranchRequest(BaseModel):
    source: str
    target: str
    strategy: MergeStrategyEnum = MergeStrategyEnum.squash
    message: str = ""


class TriggerPipelineRequest(BaseModel):
    branch: str
    name: str = "Manual Build"


class CreateWebhookRequest(BaseModel):
    url: str
    events: list[str] = ["push", "pull_request"]
    secret: str = ""


# Repositories
@router.get("/repositories")
async def list_repositories(provider: Optional[GitProviderEnum] = None):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"repositories": await svc.list_repositories(provider), "total": len(await svc.list_repositories(provider))}


@router.get("/repositories/{repo_id}")
async def get_repository(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    repo = await svc.get_repository(repo_id)
    if not repo:
        raise HTTPException(404, "Repository not found")
    return repo


@router.post("/repositories")
async def create_repository(req: CreateRepoRequest):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.create_repository(req.name, req.provider, req.description, req.is_private, req.default_branch)


@router.delete("/repositories/{repo_id}")
async def delete_repository(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    if not await svc.delete_repository(repo_id):
        raise HTTPException(404, "Repository not found")
    return {"status": "deleted"}


@router.get("/repositories/{repo_id}/stats")
async def get_repo_stats(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.get_repo_stats(repo_id)


@router.get("/repositories/{repo_id}/code-frequency")
async def get_code_frequency(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.get_code_frequency(repo_id)


# Branches
@router.get("/repositories/{repo_id}/branches")
async def list_branches(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"branches": await svc.list_branches(repo_id)}


@router.post("/repositories/{repo_id}/branches")
async def create_branch(repo_id: str, req: CreateBranchRequest):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    result = await svc.create_branch(repo_id, req.name, req.from_branch)
    if not result:
        raise HTTPException(400, "Failed to create branch")
    return result


@router.delete("/repositories/{repo_id}/branches/{branch_name}")
async def delete_branch(repo_id: str, branch_name: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    if not await svc.delete_branch(repo_id, branch_name):
        raise HTTPException(400, "Cannot delete branch")
    return {"status": "deleted"}


@router.post("/repositories/{repo_id}/merge")
async def merge_branches(repo_id: str, req: MergeBranchRequest):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.merge_branches(repo_id, req.source, req.target, req.strategy, req.message)


# Commits
@router.get("/repositories/{repo_id}/commits")
async def list_commits(repo_id: str, branch: Optional[str] = None,
                       author: Optional[str] = None, limit: int = 20):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"commits": await svc.list_commits(repo_id, branch, author, limit)}


@router.get("/repositories/{repo_id}/commits/{sha}")
async def get_commit(repo_id: str, sha: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    commit = await svc.get_commit(repo_id, sha)
    if not commit:
        raise HTTPException(404, "Commit not found")
    return commit


@router.get("/repositories/{repo_id}/commits/{sha}/diff")
async def get_commit_diff(repo_id: str, sha: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"files": await svc.get_commit_diff(repo_id, sha)}


@router.post("/repositories/{repo_id}/cherry-pick")
async def cherry_pick(repo_id: str, sha: str = Query(...), target_branch: str = Query(...)):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.cherry_pick(repo_id, sha, target_branch)


@router.post("/repositories/{repo_id}/revert/{sha}")
async def revert_commit(repo_id: str, sha: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.revert_commit(repo_id, sha)


# Tags
@router.get("/repositories/{repo_id}/tags")
async def list_tags(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"tags": await svc.list_tags(repo_id)}


@router.post("/repositories/{repo_id}/tags")
async def create_tag(repo_id: str, req: CreateTagRequest):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.create_tag(repo_id, req.name, req.sha, req.message, req.is_release)


# Pull Requests
@router.get("/repositories/{repo_id}/pull-requests")
async def list_pull_requests(repo_id: str, status: Optional[PRStatusEnum] = None):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"pull_requests": await svc.list_pull_requests(repo_id, status)}


@router.get("/repositories/{repo_id}/pull-requests/{pr_number}")
async def get_pull_request(repo_id: str, pr_number: int):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    pr = await svc.get_pull_request(repo_id, pr_number)
    if not pr:
        raise HTTPException(404, "Pull request not found")
    return pr


@router.post("/repositories/{repo_id}/pull-requests")
async def create_pull_request(repo_id: str, req: CreatePRRequest):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.create_pull_request(repo_id, req.title, req.source_branch, req.target_branch, req.description, req.reviewers)


@router.post("/repositories/{repo_id}/pull-requests/{pr_number}/merge")
async def merge_pull_request(repo_id: str, pr_number: int,
                             strategy: MergeStrategyEnum = MergeStrategyEnum.squash):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.merge_pull_request(repo_id, pr_number, strategy)


# Pipelines
@router.get("/repositories/{repo_id}/pipelines")
async def list_pipelines(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"pipelines": await svc.list_pipelines(repo_id)}


@router.post("/repositories/{repo_id}/pipelines")
async def trigger_pipeline(repo_id: str, req: TriggerPipelineRequest):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.trigger_pipeline(repo_id, req.branch, req.name)


@router.post("/repositories/{repo_id}/pipelines/{pipeline_id}/cancel")
async def cancel_pipeline(repo_id: str, pipeline_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    if not await svc.cancel_pipeline(repo_id, pipeline_id):
        raise HTTPException(400, "Cannot cancel pipeline")
    return {"status": "cancelled"}


# Blame & History
@router.get("/repositories/{repo_id}/blame")
async def get_file_blame(repo_id: str, path: str = Query(...)):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"blame": await svc.get_file_blame(repo_id, path)}


@router.get("/repositories/{repo_id}/file-history")
async def get_file_history(repo_id: str, path: str = Query(...)):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"history": await svc.get_file_history(repo_id, path)}


# Webhooks
@router.get("/repositories/{repo_id}/webhooks")
async def list_webhooks(repo_id: str):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return {"webhooks": await svc.list_webhooks(repo_id)}


@router.post("/repositories/{repo_id}/webhooks")
async def create_webhook(repo_id: str, req: CreateWebhookRequest):
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.create_webhook(repo_id, req.url, req.events, req.secret)


# Summary
@router.get("/summary")
async def get_git_summary():
    from backend.services.git_service import GitService
    svc = GitService()
    await svc.initialize()
    return await svc.get_summary()
