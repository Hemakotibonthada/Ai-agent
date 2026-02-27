"""API routes for Audit Log service."""
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()


def _get_service():
    from services.audit_log_service import get_audit_log_service
    return get_audit_log_service()


@router.get("/audit-log")
async def list_audit_entries(
    severity: Optional[str] = None,
    category: Optional[str] = None,
    user: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
):
    from services.audit_log_service import AuditFilter, AuditSeverity, AuditCategory
    svc = _get_service()
    f = AuditFilter(
        severity=AuditSeverity(severity) if severity else None,
        category=AuditCategory(category) if category else None,
        user=user,
        search_text=search,
        limit=limit,
        offset=offset,
    )
    entries, total = svc.query(f)
    from dataclasses import asdict
    return {"entries": [asdict(e) for e in entries], "total": total}


@router.get("/audit-log/stats")
async def audit_stats():
    return _get_service().get_stats()


@router.get("/audit-log/analytics")
async def audit_analytics(hours: int = Query(default=24, le=720)):
    return _get_service().get_analytics(hours)


@router.get("/audit-log/integrity")
async def verify_integrity():
    return _get_service().verify_integrity()


@router.get("/audit-log/retention-policies")
async def list_retention_policies():
    return _get_service().get_retention_policies()


@router.post("/audit-log/export")
async def export_audit_log(fmt: str = "json"):
    return await _get_service().export_entries(fmt)


@router.post("/audit-log/retention/apply")
async def apply_retention():
    return await _get_service().apply_retention()


@router.get("/audit-log/{entry_id}")
async def get_audit_entry(entry_id: str):
    from dataclasses import asdict
    entry = _get_service().get_entry(entry_id)
    if not entry:
        return {"error": "Entry not found"}
    return asdict(entry)
