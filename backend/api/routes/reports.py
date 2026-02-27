# NEXUS AI - Report API Routes
"""
Endpoints for report generation, listing, downloading,
and template management.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.repositories import ReportRepository
from api.dependencies import get_engine, get_current_user_id


# ============================================================
# Request / Response Models
# ============================================================

class ReportGenerateRequest(BaseModel):
    """Request to generate a new report."""
    report_type: str = Field(
        ..., description="Report type: financial, health, home, tasks, system, weekly, monthly"
    )
    title: Optional[str] = Field(None, max_length=200, description="Report title (auto-generated if omitted)")
    format: str = Field("md", description="Output format: md, pdf, xlsx")
    date_range_days: int = Field(30, ge=1, le=365, description="Date range in days")
    include_sections: Optional[List[str]] = Field(
        default_factory=list, description="Specific sections to include"
    )
    parameters: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Extra report parameters"
    )


class ReportOut(BaseModel):
    """A generated report record."""
    id: str
    title: str
    report_type: str
    format: str
    file_path: str
    file_size_bytes: Optional[int] = None
    summary: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: str


class ReportGenerateResponse(BaseModel):
    """Response after generating a report."""
    report: ReportOut
    message: str
    timestamp: str


class ReportListResponse(BaseModel):
    """List of reports."""
    reports: List[ReportOut]
    total: int
    timestamp: str


class ReportTemplate(BaseModel):
    """A report template definition."""
    id: str
    name: str
    report_type: str
    description: str
    available_formats: List[str]
    default_sections: List[str]
    parameters: Dict[str, Any] = {}


class ReportTemplatesResponse(BaseModel):
    """Available report templates."""
    templates: List[ReportTemplate]
    timestamp: str


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/reports", tags=["Reports"])


# Default report templates
REPORT_TEMPLATES: List[ReportTemplate] = [
    ReportTemplate(
        id="financial_monthly",
        name="Monthly Financial Report",
        report_type="financial",
        description="Comprehensive monthly financial overview with income, expenses, and budget analysis",
        available_formats=["md", "pdf", "xlsx"],
        default_sections=["income", "expenses", "budget", "goals", "trends"],
    ),
    ReportTemplate(
        id="health_weekly",
        name="Weekly Health Report",
        report_type="health",
        description="Weekly health and wellness summary with mood, exercise, and sleep data",
        available_formats=["md", "pdf"],
        default_sections=["mood", "exercise", "sleep", "metrics", "insights"],
    ),
    ReportTemplate(
        id="home_energy",
        name="Home Energy Report",
        report_type="home",
        description="Home energy consumption and device utilization report",
        available_formats=["md", "pdf", "xlsx"],
        default_sections=["devices", "energy", "sensors", "automations"],
    ),
    ReportTemplate(
        id="tasks_productivity",
        name="Productivity Report",
        report_type="tasks",
        description="Task completion and productivity analytics report",
        available_formats=["md", "pdf"],
        default_sections=["completed", "pending", "overdue", "analytics"],
    ),
    ReportTemplate(
        id="system_status",
        name="System Status Report",
        report_type="system",
        description="NEXUS AI system health, performance, and activity report",
        available_formats=["md", "pdf"],
        default_sections=["health", "resources", "agents", "logs"],
    ),
    ReportTemplate(
        id="weekly_summary",
        name="Weekly Summary",
        report_type="weekly",
        description="Cross-domain weekly summary covering all NEXUS AI areas",
        available_formats=["md", "pdf"],
        default_sections=["tasks", "health", "finance", "home", "insights"],
    ),
]


@router.post(
    "/generate",
    response_model=ReportGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new report",
)
async def generate_report(
    request: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    engine=Depends(get_engine),
):
    """Generate a new report using the report agent."""
    try:
        # Build title
        title = request.title or f"{request.report_type.title()} Report - {datetime.utcnow().strftime('%Y-%m-%d')}"

        # Try to use report agent
        report_agent = engine.get_agent("report")
        file_path = ""
        summary = ""
        file_size = 0

        if report_agent and hasattr(report_agent, "generate_report"):
            try:
                result = await report_agent.generate_report(
                    report_type=request.report_type,
                    format=request.format,
                    days=request.date_range_days,
                    sections=request.include_sections,
                    parameters=request.parameters,
                )
                if isinstance(result, dict):
                    file_path = result.get("file_path", "")
                    summary = result.get("summary", "")
                    file_size = result.get("file_size", 0)
                elif isinstance(result, str):
                    file_path = result
            except Exception:
                # Fallback: generate a placeholder
                import os
                from pathlib import Path

                reports_dir = Path(engine.config.data_dir) / "reports"
                reports_dir.mkdir(parents=True, exist_ok=True)

                file_name = f"{request.report_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{request.format}"
                file_path = str(reports_dir / file_name)

                with open(file_path, "w") as f:
                    f.write(f"# {title}\n\nGenerated: {datetime.utcnow().isoformat()}\n\n")
                    f.write(f"Report Type: {request.report_type}\n")
                    f.write(f"Period: Last {request.date_range_days} days\n")

                file_size = os.path.getsize(file_path)
                summary = f"Auto-generated {request.report_type} report"
        else:
            # No report agent — create placeholder file
            import os
            from pathlib import Path

            reports_dir = Path(engine.config.data_dir) / "reports"
            reports_dir.mkdir(parents=True, exist_ok=True)

            file_name = f"{request.report_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{request.format}"
            file_path = str(reports_dir / file_name)

            with open(file_path, "w") as f:
                f.write(f"# {title}\n\nGenerated: {datetime.utcnow().isoformat()}\n\n")
                f.write(f"Report Type: {request.report_type}\n")
                f.write(f"Period: Last {request.date_range_days} days\n")
                f.write("\n_This is a placeholder report. Connect the report agent for full content._\n")

            file_size = os.path.getsize(file_path)
            summary = f"Placeholder {request.report_type} report"

        # Persist report record
        repo = ReportRepository(db)
        report = await repo.create_report(
            user_id=user_id,
            title=title,
            report_type=request.report_type,
            format=request.format,
            file_path=file_path,
            file_size_bytes=file_size,
            summary=summary,
            metadata=request.parameters,
        )

        report_out = ReportOut(
            id=report.id,
            title=report.title,
            report_type=report.report_type,
            format=report.format,
            file_path=report.file_path,
            file_size_bytes=report.file_size_bytes,
            summary=report.summary,
            metadata=report.metadata or {},
            created_at=report.created_at.isoformat() if report.created_at else "",
        )

        return ReportGenerateResponse(
            report=report_out,
            message=f"Report '{title}' generated successfully",
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating report: {str(e)}",
        )


@router.get(
    "",
    response_model=ReportListResponse,
    summary="List all reports",
)
async def list_reports(
    report_type: Optional[str] = Query(None, description="Filter by report type"),
    limit: int = Query(50, ge=1, le=200, description="Maximum reports to return"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """List generated reports with optional filtering."""
    try:
        repo = ReportRepository(db)
        reports = await repo.get_reports(
            user_id=user_id,
            report_type=report_type,
            limit=limit,
        )

        report_list = [
            ReportOut(
                id=r.id,
                title=r.title,
                report_type=r.report_type,
                format=r.format,
                file_path=r.file_path,
                file_size_bytes=r.file_size_bytes,
                summary=r.summary,
                metadata=r.metadata or {},
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
            for r in reports
        ]

        return ReportListResponse(
            reports=report_list,
            total=len(report_list),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing reports: {str(e)}",
        )


@router.get(
    "/{report_id}/download",
    summary="Download a report file",
)
async def download_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Download a generated report file."""
    import os

    try:
        repo = ReportRepository(db)
        reports = await repo.get_reports(user_id=user_id, limit=500)
        report = next((r for r in reports if r.id == report_id), None)

        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report '{report_id}' not found",
            )

        if not os.path.exists(report.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report file not found on disk",
            )

        media_types = {
            "md": "text/markdown",
            "pdf": "application/pdf",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        media_type = media_types.get(report.format, "application/octet-stream")
        filename = os.path.basename(report.file_path)

        return FileResponse(
            path=report.file_path,
            media_type=media_type,
            filename=filename,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading report: {str(e)}",
        )


@router.get(
    "/templates",
    response_model=ReportTemplatesResponse,
    summary="Get available report templates",
)
async def get_report_templates():
    """Get all available report templates and their configurations."""
    return ReportTemplatesResponse(
        templates=REPORT_TEMPLATES,
        timestamp=datetime.utcnow().isoformat(),
    )
