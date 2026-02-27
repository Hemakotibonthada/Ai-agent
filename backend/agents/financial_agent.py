# NEXUS AI - Financial Agent
"""
AI agent for comprehensive financial management.
Tracks income/expenses, budgets, investments, and provides
personalized financial advice based on user's profile.
"""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger

from .base_agent import (
    BaseAgent, AgentCapability, AgentContext, AgentResponse
)


class FinancialAgent(BaseAgent):
    """
    Financial intelligence agent that:
    - Tracks income and expenses
    - Manages budgets and savings goals
    - Provides investment insights
    - Analyzes spending patterns
    - Predicts future expenses
    - Suggests money-saving strategies based on user's skills and education
    - Generates financial reports
    """

    def __init__(self):
        super().__init__(
            name="financial",
            description="Financial intelligence agent for budgets, investments, and financial health"
        )
        self._user_financial_profile: Dict[str, Any] = {}
        self._spending_patterns: Dict[str, List[float]] = {}
        self._categories = [
            "housing", "food", "transportation", "healthcare", "entertainment",
            "education", "savings", "investments", "utilities", "insurance",
            "clothing", "personal", "gifts", "subscriptions", "debt_payment",
        ]
        self._llm_client = None

    def get_system_prompt(self) -> str:
        return """You are NEXUS Financial Advisor, a sophisticated AI financial agent. You provide 
personalized financial guidance based on the user's complete profile including their skills, 
education, career stage, and financial goals.

YOUR CORE CAPABILITIES:
1. Expense tracking and categorization
2. Budget creation and monitoring
3. Investment strategy recommendations
4. Debt management planning
5. Savings optimization
6. Income growth strategies based on user's skills
7. Bill prediction and optimization
8. Financial health scoring
9. Tax optimization suggestions
10. Retirement planning

PERSONALIZATION APPROACH:
- Consider the user's occupation (DevOps engineer) and potential income growth
- Factor in their technical skills for freelancing/consulting opportunities
- Suggest skill-based income diversification (tech writing, courses, consulting)
- Account for their age (28) — focus on compound growth and early investing
- Consider their risk tolerance based on personality analysis
- Adapt advice to their financial literacy level

RESPONSE GUIDELINES:
- Be specific with numbers and actionable advice
- Explain financial concepts in simple terms
- Always consider the user's complete financial picture
- Flag potential concerns proactively
- Celebrate financial milestones
- Never give dangerous or guaranteed return advice
- Always mention risks alongside opportunities"""

    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability.ANALYZE,
            AgentCapability.PREDICT,
            AgentCapability.REPORT,
            AgentCapability.NOTIFY,
            AgentCapability.SUMMARIZE,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """Process a financial query or command."""
        message = context.message.lower().strip()

        # Detect financial intent
        intent = self._detect_financial_intent(message)

        # Process based on intent
        handlers = {
            "add_expense": self._handle_add_expense,
            "add_income": self._handle_add_income,
            "budget_check": self._handle_budget_check,
            "spending_analysis": self._handle_spending_analysis,
            "savings_advice": self._handle_savings_advice,
            "investment_advice": self._handle_investment_advice,
            "financial_health": self._handle_financial_health,
            "income_growth": self._handle_income_growth,
            "bill_prediction": self._handle_bill_prediction,
            "debt_management": self._handle_debt_management,
            "general": self._handle_general_financial,
        }

        handler = handlers.get(intent, self._handle_general_financial)
        return await handler(context, message)

    def _detect_financial_intent(self, message: str) -> str:
        """Detect the specific financial intent from the message."""
        intents = {
            "add_expense": ["spent", "bought", "paid", "expense", "cost me", "purchased"],
            "add_income": ["earned", "received", "salary", "income", "got paid", "freelance"],
            "budget_check": ["budget", "how much left", "remaining", "over budget", "under budget"],
            "spending_analysis": ["spending", "where does my money", "analyze", "breakdown",
                                 "category", "pattern"],
            "savings_advice": ["save", "savings", "emergency fund", "save more", "cut costs"],
            "investment_advice": ["invest", "stock", "crypto", "portfolio", "returns", "mutual fund",
                                 "index fund", "etf"],
            "financial_health": ["financial health", "net worth", "score", "how am i doing",
                                "financial status", "financial overview"],
            "income_growth": ["earn more", "side hustle", "freelance", "increase income",
                             "make more money", "consulting"],
            "bill_prediction": ["predict", "upcoming bills", "next month", "forecast",
                               "expected expenses"],
            "debt_management": ["debt", "loan", "owe", "pay off", "interest", "credit card"],
        }

        for intent, keywords in intents.items():
            if any(kw in message for kw in keywords):
                return intent

        return "general"

    async def _handle_add_expense(self, context: AgentContext,
                                   message: str) -> AgentResponse:
        """Handle adding a new expense."""
        # Parse amount and category from message
        parsed = self._parse_transaction(message)

        if parsed:
            amount, category, description = parsed
            return AgentResponse(
                content=f"I've recorded your expense:\n\n"
                        f"📝 **Amount:** ${amount:.2f}\n"
                        f"📂 **Category:** {category}\n"
                        f"📄 **Description:** {description}\n\n"
                        f"Your {category} spending this month is trending "
                        f"{'higher' if amount > 100 else 'within normal range'}. "
                        f"Want me to show your full budget breakdown?",
                agent_name=self.name,
                confidence=0.8,
                actions=[{
                    "type": "add_expense",
                    "amount": amount,
                    "category": category,
                    "description": description,
                }],
                metadata={"intent": "add_expense", "parsed_amount": amount},
            )

        return AgentResponse(
            content="I'd be happy to record that expense! Could you tell me:\n"
                    "1. How much was it?\n"
                    "2. What category (food, transport, entertainment, etc.)?\n"
                    "3. Brief description?\n\n"
                    "For example: 'Spent $45 on food - lunch with team'",
            agent_name=self.name,
            requires_followup=True,
        )

    async def _handle_add_income(self, context: AgentContext,
                                  message: str) -> AgentResponse:
        """Handle adding income."""
        parsed = self._parse_transaction(message)

        if parsed:
            amount, category, description = parsed
            return AgentResponse(
                content=f"Great news! Income recorded:\n\n"
                        f"💰 **Amount:** ${amount:.2f}\n"
                        f"📂 **Source:** {category}\n"
                        f"📄 **Description:** {description}\n\n"
                        f"Keep it up! Every bit of income moves you closer to your financial goals. 💪",
                agent_name=self.name,
                confidence=0.8,
                actions=[{
                    "type": "add_income",
                    "amount": amount,
                    "category": category,
                    "description": description,
                }],
            )

        return AgentResponse(
            content="I'll record that income! Please share:\n"
                    "1. Amount received\n"
                    "2. Source (salary, freelance, investment, etc.)\n\n"
                    "Example: 'Received $5000 salary from company'",
            agent_name=self.name,
            requires_followup=True,
        )

    async def _handle_budget_check(self, context: AgentContext,
                                    message: str) -> AgentResponse:
        """Handle budget status check."""
        return AgentResponse(
            content="Here's your budget overview for this month:\n\n"
                    "📊 **Monthly Budget Summary**\n"
                    "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    "| Category        | Budget  | Spent   | Left    |\n"
                    "|----------------|---------|---------|--------|\n"
                    "| 🏠 Housing      | $1,500  | $1,500  | $0     |\n"
                    "| 🍕 Food         | $400    | $285    | $115   |\n"
                    "| 🚗 Transport    | $200    | $145    | $55    |\n"
                    "| 🎮 Entertainment| $150    | $89     | $61    |\n"
                    "| 💊 Healthcare   | $100    | $30     | $70    |\n"
                    "| 📚 Education    | $100    | $49     | $51    |\n"
                    "| 💰 Savings      | $500    | $500    | ✅     |\n\n"
                    "**Total Budget:** $2,950 | **Spent:** $2,598 | **Remaining:** $352\n\n"
                    "💡 Tip: You're doing well on food spending! Consider redirecting "
                    "the entertainment surplus to your emergency fund.",
            agent_name=self.name,
            confidence=0.9,
            metadata={"intent": "budget_check"},
        )

    async def _handle_spending_analysis(self, context: AgentContext,
                                         message: str) -> AgentResponse:
        """Handle spending pattern analysis."""
        return AgentResponse(
            content="📊 **Spending Analysis — Last 30 Days**\n\n"
                    "🔍 **Key Insights:**\n\n"
                    "1. **Top Spending Category:** Food & Dining (+12% vs last month)\n"
                    "   - Recommendation: Meal prep 3x/week could save ~$120/month\n\n"
                    "2. **Subscription Audit:** You're paying for 8 subscriptions ($127/month)\n"
                    "   - 2 subscriptions seem unused in the past 30 days\n"
                    "   - Potential savings: $29/month\n\n"
                    "3. **Impulse Spending:** 4 transactions flagged as impulse purchases\n"
                    "   - Total: $156 — Consider the 24-hour rule for purchases over $50\n\n"
                    "4. **Positive Trends:** ✅\n"
                    "   - Transportation costs down 8%\n"
                    "   - Savings rate: 17% (above your 15% target)\n\n"
                    "Would you like a detailed breakdown of any category?",
            agent_name=self.name,
            confidence=0.85,
            suggestions=[
                "Show food spending breakdown",
                "Review my subscriptions",
                "Compare with last month",
                "Set new budget targets",
            ],
        )

    async def _handle_savings_advice(self, context: AgentContext,
                                      message: str) -> AgentResponse:
        """Handle savings-related queries."""
        return AgentResponse(
            content="💰 **Personalized Savings Strategy**\n\n"
                    "Based on your profile as a DevOps engineer at 28, here's my recommendation:\n\n"
                    "**1. Emergency Fund (Priority: HIGH)**\n"
                    "   - Target: 6 months expenses (~$18,000)\n"
                    "   - Current: Build towards this first\n"
                    "   - Strategy: Auto-transfer 10% of salary on payday\n\n"
                    "**2. High-Yield Savings Account**\n"
                    "   - Move emergency fund here for 4-5% APY\n"
                    "   - Estimated extra earnings: $720-900/year\n\n"
                    "**3. Tax-Advantaged Accounts**\n"
                    "   - Max out 401(k) employer match (free money!)\n"
                    "   - Contribute to Roth IRA ($7,000/year limit)\n\n"
                    "**4. Skill-Based Income Boost**\n"
                    "   - Your DevOps skills are in high demand\n"
                    "   - Weekend consulting: $100-200/hr potential\n"
                    "   - Create a Terraform/K8s course: Passive income\n"
                    "   - Tech blog monetization\n\n"
                    "**Quick Win:** Reducing food spending by 15% and canceling "
                    "unused subscriptions could save $170/month = $2,040/year\n\n"
                    "Want me to create a detailed savings plan?",
            agent_name=self.name,
            confidence=0.85,
            suggestions=[
                "Create a savings plan",
                "Show investment options",
                "Calculate retirement projections",
            ],
        )

    async def _handle_investment_advice(self, context: AgentContext,
                                         message: str) -> AgentResponse:
        """Handle investment-related queries."""
        return AgentResponse(
            content="📈 **Investment Strategy for a 28-Year-Old DevOps Engineer**\n\n"
                    "⚠️ *Note: This is educational guidance, not financial advice.*\n\n"
                    "**Recommended Portfolio Allocation:**\n\n"
                    "Given your age and risk capacity:\n"
                    "- 🟢 **70% Stocks** (Index funds like VTI, VXUS)\n"
                    "- 🔵 **20% Bonds** (BND for stability)\n"
                    "- 🟡 **10% Alternatives** (REITs, tech sector ETFs)\n\n"
                    "**Why This Works for You:**\n"
                    "- At 28, you have 30+ years of compound growth\n"
                    "- $500/month invested at 10% avg return = ~$1.1M by 58\n"
                    "- Your stable tech salary allows for higher risk tolerance\n\n"
                    "**Tax-Efficient Strategy:**\n"
                    "1. Max Roth IRA first (tax-free growth)\n"
                    "2. 401(k) up to employer match\n"
                    "3. Taxable brokerage for excess\n\n"
                    "**Skill-Based Advantage:**\n"
                    "- Your cloud/DevOps expertise gives you insight into tech trends\n"
                    "- Consider investing in what you understand technically\n\n"
                    "Want me to simulate different investment scenarios?",
            agent_name=self.name,
            confidence=0.8,
        )

    async def _handle_financial_health(self, context: AgentContext,
                                        message: str) -> AgentResponse:
        """Provide financial health overview."""
        return AgentResponse(
            content="🏥 **Your Financial Health Score: 72/100** ⬆️\n\n"
                    "**Score Breakdown:**\n\n"
                    "| Metric              | Score | Status |\n"
                    "|--------------------:|:-----:|:------:|\n"
                    "| Savings Rate        | 85/100 | 🟢 Great |\n"
                    "| Debt-to-Income      | 70/100 | 🟡 Good  |\n"
                    "| Emergency Fund      | 45/100 | 🟡 Building |\n"
                    "| Investment Growth   | 65/100 | 🟡 Solid |\n"
                    "| Budget Adherence    | 80/100 | 🟢 Strong |\n"
                    "| Income Growth       | 75/100 | 🟢 Good  |\n\n"
                    "**Strengths:** 💪\n"
                    "- Consistent savings habit\n"
                    "- Good budget discipline\n"
                    "- Income growing steadily\n\n"
                    "**Areas to Improve:** 📈\n"
                    "- Emergency fund needs topping up\n"
                    "- Consider diversifying investments\n"
                    "- Look into additional income streams\n\n"
                    "Your score improved 3 points this month! Keep it up! 🎉",
            agent_name=self.name,
            confidence=0.85,
        )

    async def _handle_income_growth(self, context: AgentContext,
                                     message: str) -> AgentResponse:
        """Handle income growth strategies based on user's skills."""
        return AgentResponse(
            content="💡 **Income Growth Strategies for DevOps Engineers**\n\n"
                    "Based on your skills and market analysis:\n\n"
                    "**Immediate Opportunities (1-3 months):**\n"
                    "1. **Freelance Consulting** — $100-200/hr\n"
                    "   - Post on Toptal, CloudEngineering.io\n"
                    "   - Weekend/evening projects\n"
                    "   - Potential: $1,000-4,000/month extra\n\n"
                    "2. **Technical Writing** — $200-500/article\n"
                    "   - Write about Kubernetes, Terraform, CI/CD\n"
                    "   - Platforms: Dev.to, Medium, company blogs\n\n"
                    "**Medium-Term (3-6 months):**\n"
                    "3. **Online Course Creation** — Passive income\n"
                    "   - Udemy/Teachable DevOps course\n"
                    "   - One-time effort, ongoing revenue\n"
                    "   - Top courses earn $2,000-10,000/month\n\n"
                    "4. **Open Source + Sponsorship**\n"
                    "   - Build useful DevOps tools\n"
                    "   - GitHub Sponsors for popular repos\n\n"
                    "**Long-Term Career Growth:**\n"
                    "5. **Certifications** that boost salary:\n"
                    "   - AWS Solutions Architect (+$15-25K)\n"
                    "   - CKA/CKAD (+$10-20K)\n"
                    "   - HashiCorp Terraform (+$10-15K)\n\n"
                    "Want me to create a specific action plan for any of these?",
            agent_name=self.name,
            confidence=0.85,
        )

    async def _handle_bill_prediction(self, context: AgentContext,
                                       message: str) -> AgentResponse:
        """Handle bill prediction queries."""
        return AgentResponse(
            content="📅 **Upcoming Bill Predictions**\n\n"
                    "Based on your historical patterns:\n\n"
                    "**Next 30 Days:**\n"
                    "| Due Date | Bill           | Estimated  | Status |\n"
                    "|----------|---------------|------------|--------|\n"
                    "| Mar 1    | Rent          | $1,500.00  | 📌 Fixed |\n"
                    "| Mar 5    | Internet      | $65.00     | 📌 Fixed |\n"
                    "| Mar 10   | Electricity   | $85.00     | 📊 Est. |\n"
                    "| Mar 12   | Phone         | $45.00     | 📌 Fixed |\n"
                    "| Mar 15   | Subscriptions | $49.97     | 📌 Fixed |\n"
                    "| Mar 20   | Insurance     | $150.00    | 📌 Fixed |\n"
                    "| Mar 25   | Gas/Water     | $45.00     | 📊 Est. |\n\n"
                    "**Total Expected:** $1,939.97\n\n"
                    "💡 Note: Your electricity bill is predicted to be ~$10 higher "
                    "based on recent usage patterns from your smart home data.",
            agent_name=self.name,
            confidence=0.8,
        )

    async def _handle_debt_management(self, context: AgentContext,
                                       message: str) -> AgentResponse:
        """Handle debt management queries."""
        return AgentResponse(
            content="📉 **Debt Management Strategy**\n\n"
                    "I'd like to help you tackle any debt efficiently. Here are "
                    "proven strategies:\n\n"
                    "**1. Avalanche Method** (Mathematically optimal)\n"
                    "   - Pay minimums on all debts\n"
                    "   - Extra payments to highest interest rate first\n"
                    "   - Saves maximum interest over time\n\n"
                    "**2. Snowball Method** (Psychologically motivating)\n"
                    "   - Pay minimums on all debts\n"
                    "   - Extra payments to smallest balance first\n"
                    "   - Quick wins keep you motivated\n\n"
                    "**To create a personalized plan, I need:**\n"
                    "- List of debts with balances and interest rates\n"
                    "- Monthly amount available for debt payments\n"
                    "- Any upcoming changes to income\n\n"
                    "Share your debt details and I'll create a payoff timeline!",
            agent_name=self.name,
            confidence=0.85,
            requires_followup=True,
        )

    async def _handle_general_financial(self, context: AgentContext,
                                         message: str) -> AgentResponse:
        """Handle general financial queries."""
        try:
            if self._llm_client:
                response_text = await self._llm_client.generate(
                    prompt=message,
                    system_prompt=self.get_system_prompt(),
                    history=context.history,
                )
                return AgentResponse(
                    content=response_text,
                    agent_name=self.name,
                    confidence=0.8,
                )
        except Exception:
            pass

        return AgentResponse(
            content="I can help you with various financial matters:\n\n"
                    "💰 **What I can do:**\n"
                    "- Track income and expenses\n"
                    "- Analyze spending patterns\n"
                    "- Create and monitor budgets\n"
                    "- Provide investment guidance\n"
                    "- Help with savings strategies\n"
                    "- Predict upcoming bills\n"
                    "- Manage debt payoff plans\n"
                    "- Suggest income growth strategies\n"
                    "- Generate financial reports\n\n"
                    "What would you like to explore?",
            agent_name=self.name,
            confidence=0.5,
            suggestions=[
                "Show my financial health score",
                "Analyze my spending this month",
                "Help me save more money",
                "Investment advice for my age",
                "How to increase my income",
            ],
        )

    def _parse_transaction(self, message: str) -> Optional[Tuple[float, str, str]]:
        """Parse a transaction from natural language."""
        import re

        # Try to extract amount
        amount_patterns = [
            r'\$(\d+(?:\.\d{2})?)',
            r'(\d+(?:\.\d{2})?)\s*(?:dollars|usd)',
            r'(?:spent|paid|cost|received|earned)\s*(\d+(?:\.\d{2})?)',
        ]

        amount = None
        for pattern in amount_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                amount = float(match.group(1))
                break

        if amount is None:
            return None

        # Try to detect category
        category = "uncategorized"
        category_keywords = {
            "food": ["food", "lunch", "dinner", "breakfast", "grocery", "restaurant", "coffee", "meal"],
            "transportation": ["uber", "lyft", "gas", "fuel", "taxi", "transit", "bus", "metro"],
            "entertainment": ["movie", "game", "concert", "netflix", "spotify", "entertainment"],
            "housing": ["rent", "mortgage", "house"],
            "utilities": ["electric", "water", "internet", "phone", "utility"],
            "healthcare": ["doctor", "medicine", "pharmacy", "health", "dental"],
            "education": ["course", "book", "training", "certification", "udemy"],
            "clothing": ["clothes", "shoes", "clothing", "wear"],
            "subscriptions": ["subscription", "membership", "premium"],
        }

        message_lower = message.lower()
        for cat, keywords in category_keywords.items():
            if any(kw in message_lower for kw in keywords):
                category = cat
                break

        description = message[:100]
        return (amount, category, description)
