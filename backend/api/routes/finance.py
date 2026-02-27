# NEXUS AI - Financial API Routes
"""
Endpoints for financial management: transactions, budgets,
goals, spending summaries, and financial dashboards.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.repositories import FinancialRepository
from api.dependencies import get_current_user_id


# ============================================================
# Request / Response Models
# ============================================================

class TransactionRequest(BaseModel):
    """Request to record a financial transaction."""
    transaction_type: str = Field(
        ..., description="Type: income, expense, investment, savings, transfer"
    )
    amount: float = Field(..., gt=0, description="Transaction amount")
    category: str = Field(..., min_length=1, max_length=50, description="Category")
    subcategory: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    currency: str = Field("USD", max_length=10)
    date: Optional[str] = Field(None, description="Transaction date ISO string")
    tags: Optional[List[str]] = Field(default_factory=list)
    is_recurring: bool = Field(False, description="Is this a recurring transaction")
    recurrence_pattern: Optional[str] = Field(None, description="e.g., monthly, weekly")


class TransactionResponse(BaseModel):
    """Response after recording a transaction."""
    id: str
    transaction_type: str
    amount: float
    category: str
    currency: str
    date: str
    message: str


class FinancialSummaryResponse(BaseModel):
    """Financial summary for a period."""
    period_start: str
    period_end: str
    total_income: float = 0.0
    total_expenses: float = 0.0
    net_savings: float = 0.0
    spending_by_category: Dict[str, float] = {}
    recent_transactions: List[Dict[str, Any]] = []
    timestamp: str


class BudgetItem(BaseModel):
    """A single budget category item."""
    category: str
    budget_amount: float
    spent_amount: float = 0.0
    remaining: float = 0.0
    percent_used: float = 0.0


class BudgetRequest(BaseModel):
    """Request to create or update budget items."""
    month: int = Field(..., ge=1, le=12, description="Budget month")
    year: int = Field(..., ge=2000, le=2100, description="Budget year")
    categories: List[Dict[str, float]] = Field(
        ..., description="List of {category: amount} items"
    )
    notes: Optional[str] = Field(None, max_length=500)


class BudgetResponse(BaseModel):
    """Budget overview response."""
    month: int
    year: int
    items: List[BudgetItem] = []
    total_budget: float = 0.0
    total_spent: float = 0.0
    total_remaining: float = 0.0
    timestamp: str


class FinancialGoalOut(BaseModel):
    """A financial goal."""
    id: str
    name: str
    target_amount: float
    current_amount: float = 0.0
    progress_percent: float = 0.0
    category: str = "general"
    deadline: Optional[str] = None
    status: str = "active"
    created_at: str


class FinanceDashboardResponse(BaseModel):
    """Aggregated financial dashboard data."""
    income_this_month: float = 0.0
    expenses_this_month: float = 0.0
    savings_this_month: float = 0.0
    spending_by_category: Dict[str, float] = {}
    budget_status: List[BudgetItem] = []
    goals: List[FinancialGoalOut] = []
    recent_transactions: List[Dict[str, Any]] = []
    insights: List[str] = []
    timestamp: str


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/finance", tags=["Finance"])


@router.post(
    "/transaction",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a financial transaction",
)
async def add_transaction(
    request: TransactionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Record a new financial transaction (income, expense, investment, etc.)."""
    try:
        repo = FinancialRepository(db)

        txn_date = datetime.fromisoformat(request.date) if request.date else datetime.utcnow()

        record = await repo.add_record(
            user_id=user_id,
            transaction_type=request.transaction_type,
            amount=request.amount,
            category=request.category,
            date=txn_date,
            subcategory=request.subcategory,
            description=request.description,
            source=request.source,
            currency=request.currency,
            tags=request.tags,
            is_recurring=request.is_recurring,
            recurrence_pattern=request.recurrence_pattern,
        )

        return TransactionResponse(
            id=record.id,
            transaction_type=record.transaction_type,
            amount=record.amount,
            category=record.category,
            currency=record.currency,
            date=txn_date.isoformat(),
            message="Transaction recorded successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error recording transaction: {str(e)}",
        )


@router.get(
    "/summary",
    response_model=FinancialSummaryResponse,
    summary="Get financial summary",
)
async def get_financial_summary(
    days: int = Query(30, ge=1, le=365, description="Period in days"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get a financial summary for a given period."""
    try:
        repo = FinancialRepository(db)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Spending by category
        spending = await repo.get_spending_summary(user_id, start_date, end_date)

        # Total income
        total_income = await repo.get_income_summary(user_id, start_date, end_date)

        total_expenses = sum(spending.values()) if spending else 0.0

        # Recent transactions
        recent = await repo.get_records(user_id=user_id, start_date=start_date, end_date=end_date, limit=20)
        recent_list = [
            {
                "id": r.id,
                "type": r.transaction_type,
                "amount": r.amount,
                "category": r.category,
                "description": r.description,
                "date": r.date.isoformat() if r.date else "",
                "currency": r.currency,
            }
            for r in recent
        ]

        return FinancialSummaryResponse(
            period_start=start_date.isoformat(),
            period_end=end_date.isoformat(),
            total_income=round(total_income, 2),
            total_expenses=round(total_expenses, 2),
            net_savings=round(total_income - total_expenses, 2),
            spending_by_category={k: round(v, 2) for k, v in spending.items()},
            recent_transactions=recent_list,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching financial summary: {str(e)}",
        )


@router.get(
    "/budget",
    response_model=BudgetResponse,
    summary="Get budget for a month",
)
async def get_budget(
    month: int = Query(..., ge=1, le=12, description="Month"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get budget items for a specific month and year."""
    try:
        repo = FinancialRepository(db)
        budgets = await repo.get_budget(user_id=user_id, month=month, year=year)

        items = []
        total_budget = 0.0
        total_spent = 0.0

        for b in budgets:
            remaining = b.budget_amount - b.spent_amount
            pct = (b.spent_amount / b.budget_amount * 100) if b.budget_amount > 0 else 0
            items.append(BudgetItem(
                category=b.category,
                budget_amount=round(b.budget_amount, 2),
                spent_amount=round(b.spent_amount, 2),
                remaining=round(remaining, 2),
                percent_used=round(pct, 1),
            ))
            total_budget += b.budget_amount
            total_spent += b.spent_amount

        return BudgetResponse(
            month=month,
            year=year,
            items=items,
            total_budget=round(total_budget, 2),
            total_spent=round(total_spent, 2),
            total_remaining=round(total_budget - total_spent, 2),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching budget: {str(e)}",
        )


@router.post(
    "/budget",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or update budget",
)
async def create_budget(
    request: BudgetRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Create or update budget categories for a specific month."""
    try:
        from database.models import Budget
        import uuid

        items: List[BudgetItem] = []
        total_budget = 0.0

        for cat_item in request.categories:
            for category, amount in cat_item.items():
                budget = Budget(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    month=request.month,
                    year=request.year,
                    category=category,
                    budget_amount=amount,
                    notes=request.notes,
                )
                db.add(budget)

                items.append(BudgetItem(
                    category=category,
                    budget_amount=round(amount, 2),
                    spent_amount=0.0,
                    remaining=round(amount, 2),
                    percent_used=0.0,
                ))
                total_budget += amount

        await db.flush()

        return BudgetResponse(
            month=request.month,
            year=request.year,
            items=items,
            total_budget=round(total_budget, 2),
            total_spent=0.0,
            total_remaining=round(total_budget, 2),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating budget: {str(e)}",
        )


@router.get(
    "/goals",
    response_model=List[FinancialGoalOut],
    summary="Get financial goals",
)
async def get_goals(
    goal_status: str = Query("active", description="Filter by status: active, completed, all"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get all financial goals for the user."""
    try:
        repo = FinancialRepository(db)
        goals = await repo.get_goals(user_id=user_id, status=goal_status)

        return [
            FinancialGoalOut(
                id=g.id,
                name=g.name,
                target_amount=g.target_amount,
                current_amount=g.current_amount,
                progress_percent=round(
                    (g.current_amount / g.target_amount * 100) if g.target_amount > 0 else 0, 1
                ),
                category=g.category,
                deadline=g.deadline.isoformat() if g.deadline else None,
                status=g.status,
                created_at=g.created_at.isoformat() if g.created_at else "",
            )
            for g in goals
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching goals: {str(e)}",
        )


@router.get(
    "/dashboard",
    response_model=FinanceDashboardResponse,
    summary="Get financial dashboard",
)
async def finance_dashboard(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get an aggregated financial dashboard for the current month."""
    try:
        repo = FinancialRepository(db)
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Income & expenses this month
        total_income = await repo.get_income_summary(user_id, month_start, now)
        spending = await repo.get_spending_summary(user_id, month_start, now)
        total_expenses = sum(spending.values()) if spending else 0.0

        # Goals
        goals = await repo.get_goals(user_id=user_id, status="active")
        goals_out = [
            FinancialGoalOut(
                id=g.id,
                name=g.name,
                target_amount=g.target_amount,
                current_amount=g.current_amount,
                progress_percent=round(
                    (g.current_amount / g.target_amount * 100) if g.target_amount > 0 else 0, 1
                ),
                category=g.category,
                deadline=g.deadline.isoformat() if g.deadline else None,
                status=g.status,
                created_at=g.created_at.isoformat() if g.created_at else "",
            )
            for g in goals
        ]

        # Budget
        budgets = await repo.get_budget(user_id=user_id, month=now.month, year=now.year)
        budget_items = []
        for b in budgets:
            remaining = b.budget_amount - b.spent_amount
            pct = (b.spent_amount / b.budget_amount * 100) if b.budget_amount > 0 else 0
            budget_items.append(BudgetItem(
                category=b.category,
                budget_amount=round(b.budget_amount, 2),
                spent_amount=round(b.spent_amount, 2),
                remaining=round(remaining, 2),
                percent_used=round(pct, 1),
            ))

        # Recent transactions
        recent = await repo.get_records(user_id=user_id, limit=10)
        recent_list = [
            {
                "id": r.id,
                "type": r.transaction_type,
                "amount": r.amount,
                "category": r.category,
                "description": r.description,
                "date": r.date.isoformat() if r.date else "",
            }
            for r in recent
        ]

        # Insights
        insights: List[str] = []
        if total_expenses > total_income and total_income > 0:
            insights.append("You are spending more than your income this month.")
        over_budget = [b for b in budget_items if b.percent_used > 90]
        if over_budget:
            cats = ", ".join(b.category for b in over_budget)
            insights.append(f"Budget nearing limit for: {cats}")
        if not insights:
            insights.append("Your finances look healthy this month!")

        return FinanceDashboardResponse(
            income_this_month=round(total_income, 2),
            expenses_this_month=round(total_expenses, 2),
            savings_this_month=round(total_income - total_expenses, 2),
            spending_by_category={k: round(v, 2) for k, v in spending.items()},
            budget_status=budget_items,
            goals=goals_out,
            recent_transactions=recent_list,
            insights=insights,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building finance dashboard: {str(e)}",
        )
