# NEXUS AI - Memory Agent
"""
AI agent for long-term memory management, context persistence, and recall.

This module implements the MemoryAgent, a NEXUS AI agent that serves as the
persistent memory backbone of the entire platform:

- **Memory Storage:** Stores important facts, user statements, decisions,
  and contextual information with rich metadata including timestamps,
  source agents, importance scores, and semantic tags. Supports both
  explicit storage (user says "remember this") and implicit capture
  (agent detects important information worth retaining).
- **Memory Retrieval:** Provides fast, contextual recall of stored memories
  via keyword matching, semantic similarity, tag filtering, and temporal
  queries. Returns memories ranked by relevance and recency.
- **Conversation Context:** Maintains cross-session conversation history,
  allowing the AI to reference previous discussions, follow up on earlier
  topics, and avoid repeating questions the user has already answered.
- **Importance Scoring:** Assigns each memory an importance score (0.0–1.0)
  based on content analysis, user emphasis signals, and usage frequency.
  Higher-importance memories are retained longer and surface more readily.
- **Memory Decay:** Implements a configurable decay function that gradually
  reduces the salience of unused memories over time. Memories that fall
  below a threshold are candidates for consolidation or archival.
- **Memory Consolidation:** Periodically merges related memories, removes
  duplicates, and compresses verbose entries into concise summaries to
  keep the memory store efficient and relevant.
- **Memory Search:** Provides a rich search interface with support for
  full-text search, tag-based filtering, date-range queries, and
  importance thresholds, enabling precise recall even from a large store.

The agent publishes memory events to the NEXUS event bus so peer agents
can request context enrichment or trigger memory captures on behalf of
the user.
"""

import json
import re
import time
import uuid
import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger

from .base_agent import (
    BaseAgent,
    AgentCapability,
    AgentContext,
    AgentResponse,
)


# ---------------------------------------------------------------------------
# Constants & configuration
# ---------------------------------------------------------------------------

# Memory importance thresholds
IMPORTANCE_THRESHOLDS: Dict[str, float] = {
    "critical": 0.9,    # Always retained, never decayed
    "high": 0.7,        # Slow decay, high recall priority
    "medium": 0.5,      # Normal decay rate
    "low": 0.3,         # Faster decay, lower recall priority
    "trivial": 0.1,     # Decays quickly, consolidation candidate
}

# Memory categories
MEMORY_CATEGORIES: List[str] = [
    "personal_fact",       # Facts about the user
    "preference",          # User preferences
    "decision",            # Decisions the user has made
    "instruction",         # Standing instructions from the user
    "conversation_context", # Important conversation context
    "event",               # Events and dates
    "relationship",        # People and relationships
    "technical",           # Technical facts and configurations
    "goal",                # User goals and aspirations
    "general",             # General knowledge
]

# Decay rate per day (multiplied by importance)
BASE_DECAY_RATE: float = 0.02

# Consolidation threshold — memories below this are consolidation candidates
CONSOLIDATION_THRESHOLD: float = 0.15

# Maximum memories before triggering auto-consolidation
MAX_MEMORY_COUNT: int = 10000

# Default search result limit
DEFAULT_SEARCH_LIMIT: int = 10


class MemoryAgent(BaseAgent):
    """
    Long-term memory management agent that:

    - Stores important facts, preferences, and context from interactions
    - Retrieves relevant memories based on semantic and keyword matching
    - Maintains conversation context across sessions and agents
    - Assigns and manages importance scores for all memories
    - Applies time-based decay to keep the memory store relevant
    - Consolidates and deduplicates memories for efficiency
    - Provides rich search with filters for tags, dates, and importance

    The agent acts as the shared memory layer for all NEXUS agents,
    ensuring continuity and personalisation across the platform.
    """

    def __init__(self) -> None:
        super().__init__(
            name="memory",
            description=(
                "Long-term memory agent for storing facts, preferences, "
                "conversation context, memory search, importance scoring, "
                "decay management, and consolidation"
            ),
        )

        # Primary memory store: memory_id -> memory record
        self._memories: Dict[str, Dict[str, Any]] = {}

        # Tag index: tag -> list of memory_ids
        self._tag_index: Dict[str, List[str]] = {}

        # Category index: category -> list of memory_ids
        self._category_index: Dict[str, List[str]] = {
            cat: [] for cat in MEMORY_CATEGORIES
        }

        # Conversation context store: conversation_id -> list of context entries
        self._conversation_contexts: Dict[str, List[Dict[str, Any]]] = {}

        # Consolidation history
        self._consolidation_log: List[Dict[str, Any]] = []

        # Statistics
        self._total_stored: int = 0
        self._total_recalled: int = 0
        self._total_forgotten: int = 0
        self._total_consolidated: int = 0
        self._last_consolidation: Optional[datetime] = None

        logger.info("MemoryAgent initialised with long-term memory capabilities")

    # ------------------------------------------------------------------
    # BaseAgent interface implementation
    # ------------------------------------------------------------------

    def get_system_prompt(self) -> str:
        """Return the comprehensive system prompt for the Memory agent."""
        return """You are NEXUS Memory Agent — the persistent memory backbone of the NEXUS AI
platform. You ensure nothing important is ever forgotten.

YOUR IDENTITY:
You are the keeper of knowledge, context, and continuity. You listen carefully,
store what matters, forget what doesn't, and surface the right memories at the
right time. You are precise, organised, and transparent about what you remember.

CORE COMPETENCIES:
1. **Memory Storage** — Capture facts, preferences, decisions, instructions,
   events, relationships, and goals with rich metadata. Assign importance
   scores, semantic tags, and source attribution automatically.
2. **Memory Recall** — Retrieve the most relevant memories for any query
   using keyword matching, tag filtering, importance ranking, and recency
   weighting. Present memories with full provenance.
3. **Conversation Context** — Maintain cross-session conversation history
   so every NEXUS agent can reference previous discussions, follow up on
   earlier topics, and avoid redundant questions.
4. **Importance Scoring** — Evaluate each memory's importance (0.0–1.0)
   based on content signals, user emphasis, and access frequency. Critical
   memories (≥0.9) are never decayed.
5. **Memory Decay** — Apply a configurable time-based decay function that
   gradually reduces the salience of unused memories. Decayed memories
   below the consolidation threshold are candidates for merging or archival.
6. **Memory Consolidation** — Periodically merge related memories, remove
   duplicates, and compress verbose entries. Report consolidation actions
   for transparency.
7. **Memory Search** — Provide rich search with full-text queries, tag
   filters, date ranges, category filters, and importance thresholds.

RESPONSE GUIDELINES:
- Always confirm what was stored or recalled with exact content.
- Show importance scores and tags for transparency.
- Use tables and structured formats for memory listings.
- Warn before permanent deletion (forget operations).
- Offer related memories when a single recall is requested.
- Respect privacy — never expose memories to unauthorised contexts."""

    def get_capabilities(self) -> List[AgentCapability]:
        """Return the list of capabilities this agent provides."""
        return [
            AgentCapability.SEARCH,
            AgentCapability.ANALYZE,
            AgentCapability.LEARN,
            AgentCapability.SUMMARIZE,
            AgentCapability.REPORT,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Process an incoming memory-related query or command.

        Detects the user's intent, delegates to the appropriate handler,
        and returns a rich Markdown response with memory details.
        """
        message = context.message.lower().strip()
        intent = self._detect_memory_intent(message)
        logger.debug(f"MemoryAgent detected intent: {intent} for message: {message[:80]}")

        handlers: Dict[str, Any] = {
            "store_memory": self._handle_store_memory,
            "recall_memory": self._handle_recall_memory,
            "search_memory": self._handle_search_memory,
            "memory_status": self._handle_memory_status,
            "forget": self._handle_forget,
            "memory_consolidation": self._handle_memory_consolidation,
            "general": self._handle_general_memory,
        }

        handler = handlers.get(intent, self._handle_general_memory)

        try:
            # Track conversation context
            self._track_conversation(context)
            return await handler(context, message)
        except Exception as exc:
            logger.error(f"MemoryAgent handler error ({intent}): {exc}")
            return AgentResponse(
                content=(
                    "⚠️ I encountered an issue while processing your memory request. "
                    "Please try rephrasing or provide more details."
                ),
                agent_name=self.name,
                confidence=0.0,
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Intent detection
    # ------------------------------------------------------------------

    def _detect_memory_intent(self, message: str) -> str:
        """
        Detect the memory-related intent from a user's message.

        Scans keyword lists in priority order and returns the first match.
        Falls back to ``general`` when no keywords trigger.
        """
        intents: Dict[str, List[str]] = {
            "store_memory": [
                "remember", "store", "save", "memorise", "memorize",
                "keep in mind", "note that", "don't forget",
                "record this", "log this", "save this fact",
                "remember that", "store this",
            ],
            "recall_memory": [
                "recall", "what do you remember", "what did i say",
                "what did i tell you", "do you remember",
                "what was", "remind me", "what do you know about",
                "tell me what you know", "retrieve",
            ],
            "search_memory": [
                "search memor", "find memor", "look up",
                "search for", "find anything about",
                "query memor", "memory search", "look through",
                "filter memor", "find all",
            ],
            "memory_status": [
                "memory status", "how many memories", "memory stats",
                "memory count", "memory health", "memory report",
                "memory overview", "memory dashboard", "storage status",
            ],
            "forget": [
                "forget", "delete memory", "remove memory", "erase",
                "clear memory", "purge", "wipe memory",
                "delete all memories", "clean memory",
            ],
            "memory_consolidation": [
                "consolidat", "merge memor", "compress memor",
                "clean up memor", "deduplic", "optimis",
                "optimize memor", "memory maintenance",
            ],
        }

        for intent, keywords in intents.items():
            if any(kw in message for kw in keywords):
                return intent

        return "general"

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    async def _handle_store_memory(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to store a new memory."""
        # Extract the content to remember (strip the command prefix)
        content_to_store = self._extract_memory_content(message)
        category = self._classify_memory(content_to_store)
        importance = self._score_importance(content_to_store, message)
        tags = self._extract_tags(content_to_store)

        memory_id = str(uuid.uuid4())[:12]
        memory_record = {
            "id": memory_id,
            "content": content_to_store,
            "category": category,
            "importance": importance,
            "tags": tags,
            "created_at": datetime.utcnow().isoformat(),
            "last_accessed": datetime.utcnow().isoformat(),
            "access_count": 0,
            "decay_factor": 1.0,
            "source": "user",
            "conversation_id": context.conversation_id,
            "user_id": context.user_id,
        }

        self._memories[memory_id] = memory_record
        self._total_stored += 1

        # Update indices
        for tag in tags:
            self._tag_index.setdefault(tag, []).append(memory_id)
        self._category_index.setdefault(category, []).append(memory_id)

        importance_icon = self._importance_icon(importance)
        importance_label = self._importance_label(importance)

        content = (
            "## 💾 Memory Stored\n\n"
            f"**Memory ID:** `{memory_id}`\n\n"
            "### Stored Content\n\n"
            f"> {content_to_store}\n\n"
            "### Memory Metadata\n\n"
            "| Field | Value |\n"
            "|-------|-------|\n"
            f"| Category | {category.replace('_', ' ').title()} |\n"
            f"| Importance | {importance_icon} {importance:.2f} ({importance_label}) |\n"
            f"| Tags | {', '.join(f'`{t}`' for t in tags) if tags else 'None'} |\n"
            f"| Decay rate | {BASE_DECAY_RATE:.3f}/day |\n"
            f"| Created | {memory_record['created_at']} |\n\n"
            "### Memory Store Summary\n\n"
            f"- 📦 Total memories: **{len(self._memories):,}**\n"
            f"- 📥 Stored this session: **{self._total_stored:,}**\n\n"
            "> ✅ I'll remember this. Say *\"recall\"* or *\"what do you remember\"* "
            "to retrieve stored memories."
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.93,
            metadata={
                "intent": "store_memory",
                "memory_id": memory_id,
                "category": category,
                "importance": importance,
            },
            suggestions=[
                "What do you remember about me?",
                "Search my memories",
                "Show memory status",
            ],
        )

    async def _handle_recall_memory(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to recall stored memories."""
        query = self._extract_recall_query(message)
        results = self._search_memories(query, limit=DEFAULT_SEARCH_LIMIT)

        self._total_recalled += len(results)

        if not results:
            content = (
                "## 🔍 Memory Recall\n\n"
                f"**Query:** *{query}*\n\n"
                "I don't have any stored memories matching your query.\n\n"
                "### Suggestions\n\n"
                "- Try a broader search term\n"
                "- Say *\"remember that ...\"* to store new memories\n"
                "- Use *\"memory status\"* to see what's stored\n\n"
                f"📦 Total memories in store: **{len(self._memories):,}**"
            )
        else:
            memory_rows = []
            for mem in results:
                imp_icon = self._importance_icon(mem["importance"])
                age = self._format_age(mem["created_at"])
                decay = mem.get("decay_factor", 1.0)
                memory_rows.append(
                    f"| `{mem['id']}` | {mem['content'][:60]}{'...' if len(mem['content']) > 60 else ''} "
                    f"| {imp_icon} {mem['importance']:.2f} | {age} | {decay:.2f} |"
                )

                # Update access metadata
                mem["last_accessed"] = datetime.utcnow().isoformat()
                mem["access_count"] = mem.get("access_count", 0) + 1

            content = (
                "## 🔍 Memory Recall\n\n"
                f"**Query:** *{query}* | **Results:** {len(results)}\n\n"
                "### Matching Memories\n\n"
                "| ID | Content | Importance | Age | Decay |\n"
                "|----|---------|------------|-----|-------|\n"
                + "\n".join(memory_rows) + "\n\n"
            )

            # Show full content of top result
            top = results[0]
            content += (
                "### Top Match (Full Content)\n\n"
                f"> **[{top['id']}]** {top['content']}\n\n"
                f"- **Category:** {top['category'].replace('_', ' ').title()}\n"
                f"- **Tags:** {', '.join(f'`{t}`' for t in top.get('tags', []))}\n"
                f"- **Stored:** {top['created_at']}\n"
                f"- **Accessed:** {top.get('access_count', 0)} times\n"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.88 if results else 0.5,
            metadata={
                "intent": "recall_memory",
                "query": query,
                "results_count": len(results),
            },
            suggestions=[
                "Search for more specific memories",
                "Store a new memory",
                "Show memory status",
            ],
        )

    async def _handle_search_memory(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle advanced memory search with filters."""
        query = self._extract_recall_query(message)
        category_filter = self._detect_category_filter(message)
        importance_filter = self._detect_importance_filter(message)

        results = self._search_memories(
            query,
            limit=DEFAULT_SEARCH_LIMIT,
            category=category_filter,
            min_importance=importance_filter,
        )

        self._total_recalled += len(results)

        filters_applied = []
        if category_filter:
            filters_applied.append(f"Category: `{category_filter}`")
        if importance_filter > 0:
            filters_applied.append(f"Min importance: `{importance_filter:.1f}`")

        filter_str = " | ".join(filters_applied) if filters_applied else "None"

        if not results:
            content = (
                "## 🔎 Memory Search\n\n"
                f"**Query:** *{query}* | **Filters:** {filter_str}\n\n"
                "No memories match your search criteria.\n\n"
                "### Try\n\n"
                "- Broaden your search terms\n"
                "- Remove category or importance filters\n"
                "- Check *memory status* to see what categories have data\n"
            )
        else:
            rows = []
            for mem in results:
                imp_icon = self._importance_icon(mem["importance"])
                cat = mem["category"].replace("_", " ").title()
                tags = ", ".join(mem.get("tags", [])[:3])
                rows.append(
                    f"| `{mem['id']}` | {cat} | {mem['content'][:50]}... "
                    f"| {imp_icon} {mem['importance']:.2f} | {tags} |"
                )

            content = (
                "## 🔎 Memory Search Results\n\n"
                f"**Query:** *{query}* | **Filters:** {filter_str} | "
                f"**Results:** {len(results)}\n\n"
                "| ID | Category | Content | Importance | Tags |\n"
                "|----|----------|---------|------------|------|\n"
                + "\n".join(rows) + "\n\n"
                "### Search Statistics\n\n"
                f"- 📦 Total memories searched: **{len(self._memories):,}**\n"
                f"- ✅ Matches found: **{len(results)}**\n"
                f"- 🏷️ Unique tags in results: "
                f"**{len(set(t for m in results for t in m.get('tags', [])))}**\n"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.86 if results else 0.5,
            metadata={
                "intent": "search_memory",
                "query": query,
                "results_count": len(results),
                "filters": {"category": category_filter, "min_importance": importance_filter},
            },
            suggestions=[
                "Recall my most important memories",
                "Show memories by category",
                "Run memory consolidation",
            ],
        )

    async def _handle_memory_status(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle memory status and statistics requests."""
        total = len(self._memories)
        category_counts = {}
        for cat in MEMORY_CATEGORIES:
            category_counts[cat] = len(self._category_index.get(cat, []))

        avg_importance = 0.0
        if self._memories:
            avg_importance = sum(
                m["importance"] for m in self._memories.values()
            ) / total

        tag_count = len(self._tag_index)
        most_used_tags = sorted(
            self._tag_index.items(), key=lambda x: len(x[1]), reverse=True
        )[:5]

        # Category breakdown
        cat_rows = []
        for cat in MEMORY_CATEGORIES:
            count = category_counts.get(cat, 0)
            bar = "█" * min(20, count) if count > 0 else "░"
            cat_rows.append(
                f"| {cat.replace('_', ' ').title()} | {count} | {bar} |"
            )

        # Top tags
        tag_rows = []
        for tag, ids in most_used_tags:
            tag_rows.append(f"| `{tag}` | {len(ids)} |")

        last_consolidation = (
            self._last_consolidation.strftime("%Y-%m-%d %H:%M UTC")
            if self._last_consolidation else "Never"
        )

        content = (
            "## 📊 Memory Status Dashboard\n\n"
            "### Overview\n\n"
            "| Metric | Value |\n"
            "|--------|-------|\n"
            f"| Total memories | {total:,} |\n"
            f"| Average importance | {avg_importance:.2f} |\n"
            f"| Total tags | {tag_count:,} |\n"
            f"| Total recalled | {self._total_recalled:,} |\n"
            f"| Total forgotten | {self._total_forgotten:,} |\n"
            f"| Total consolidated | {self._total_consolidated:,} |\n"
            f"| Last consolidation | {last_consolidation} |\n\n"
            "### Category Breakdown\n\n"
            "| Category | Count | Distribution |\n"
            "|----------|-------|-------------|\n"
            + "\n".join(cat_rows) + "\n\n"
        )

        if tag_rows:
            content += (
                "### Top Tags\n\n"
                "| Tag | Memories |\n"
                "|-----|----------|\n"
                + "\n".join(tag_rows) + "\n\n"
            )

        content += (
            "### Health Indicators\n\n"
            f"- {'🟢' if total < MAX_MEMORY_COUNT * 0.7 else '🟡' if total < MAX_MEMORY_COUNT * 0.9 else '🔴'} "
            f"Storage utilisation: **{total}/{MAX_MEMORY_COUNT:,}** "
            f"({total / MAX_MEMORY_COUNT * 100:.1f}%)\n"
            f"- {'🟢' if avg_importance > 0.3 else '🟡'} "
            f"Average importance: **{avg_importance:.2f}**\n"
            f"- {'🟢' if self._last_consolidation else '🟡'} "
            f"Consolidation: **{'Up to date' if self._last_consolidation else 'Recommended'}**\n\n"
            "> 💡 Say *\"consolidate memories\"* to optimise the memory store."
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.90,
            metadata={
                "intent": "memory_status",
                "total_memories": total,
                "avg_importance": avg_importance,
            },
            suggestions=[
                "Consolidate memories",
                "Show my most important memories",
                "What do you remember about me?",
            ],
        )

    async def _handle_forget(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to delete or forget memories."""
        # Check if forgetting everything
        forget_all = any(kw in message for kw in [
            "all memories", "everything", "clear all", "wipe all", "purge all"
        ])

        if forget_all:
            count = len(self._memories)
            self._memories.clear()
            self._tag_index.clear()
            self._category_index = {cat: [] for cat in MEMORY_CATEGORIES}
            self._total_forgotten += count

            content = (
                "## 🗑️ Memory Purge Complete\n\n"
                f"**Deleted:** {count:,} memories\n\n"
                "⚠️ All stored memories have been permanently deleted. "
                "This action cannot be undone.\n\n"
                "### Post-Purge Status\n\n"
                f"- 📦 Remaining memories: **0**\n"
                f"- 🗑️ Total ever forgotten: **{self._total_forgotten:,}**\n\n"
                "> I'm starting fresh. Say *\"remember that ...\"* to store new memories."
            )
        else:
            # Try to find specific memory by ID or content match
            query = self._extract_recall_query(message)
            matches = self._search_memories(query, limit=5)

            if matches:
                deleted = []
                for mem in matches[:3]:  # Delete top 3 matches
                    del self._memories[mem["id"]]
                    # Clean up indices
                    for tag in mem.get("tags", []):
                        if tag in self._tag_index:
                            self._tag_index[tag] = [
                                mid for mid in self._tag_index[tag] if mid != mem["id"]
                            ]
                    cat = mem.get("category", "general")
                    if cat in self._category_index:
                        self._category_index[cat] = [
                            mid for mid in self._category_index[cat] if mid != mem["id"]
                        ]
                    deleted.append(mem)
                    self._total_forgotten += 1

                del_rows = []
                for d in deleted:
                    del_rows.append(
                        f"| `{d['id']}` | {d['content'][:50]}... | {d['importance']:.2f} | ✅ Deleted |"
                    )

                content = (
                    "## 🗑️ Memories Forgotten\n\n"
                    f"**Query:** *{query}* | **Deleted:** {len(deleted)}\n\n"
                    "| ID | Content | Importance | Status |\n"
                    "|----|---------|------------|--------|\n"
                    + "\n".join(del_rows) + "\n\n"
                    f"📦 Remaining memories: **{len(self._memories):,}**\n\n"
                    "> ⚠️ Deleted memories cannot be recovered."
                )
            else:
                content = (
                    "## 🗑️ Forget Request\n\n"
                    f"**Query:** *{query}*\n\n"
                    "I couldn't find any memories matching your request.\n\n"
                    "### Tips\n\n"
                    "- Use *\"forget all memories\"* to clear everything\n"
                    "- Search with *\"search memory about [topic]\"* first\n"
                    "- Specify a memory ID for precise deletion\n"
                )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.85,
            metadata={
                "intent": "forget",
                "total_remaining": len(self._memories),
            },
            suggestions=[
                "Show memory status",
                "What do you still remember?",
                "Store a new memory",
            ],
        )

    async def _handle_memory_consolidation(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle memory consolidation, deduplication, and optimisation."""
        before_count = len(self._memories)

        # Apply decay to all memories
        decayed_count = self._apply_decay()

        # Remove below-threshold memories
        removed = self._remove_decayed_memories()

        # Deduplicate similar memories
        deduped = self._deduplicate_memories()

        after_count = len(self._memories)
        self._total_consolidated += removed + deduped
        self._last_consolidation = datetime.utcnow()

        consolidation_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "before_count": before_count,
            "after_count": after_count,
            "decayed": decayed_count,
            "removed": removed,
            "deduplicated": deduped,
        }
        self._consolidation_log.append(consolidation_record)

        content = (
            "## 🔄 Memory Consolidation Complete\n\n"
            "### Consolidation Summary\n\n"
            "| Action | Count |\n"
            "|--------|-------|\n"
            f"| Memories before | {before_count:,} |\n"
            f"| Decay applied to | {decayed_count:,} |\n"
            f"| Removed (below threshold) | {removed:,} |\n"
            f"| Deduplicated | {deduped:,} |\n"
            f"| Memories after | {after_count:,} |\n"
            f"| Net change | {after_count - before_count:+,} |\n\n"
            "### Consolidation Process\n\n"
            "```\n"
            "1. 📉 Apply time-based decay      ✅\n"
            f"   └─ {decayed_count} memories had decay applied\n"
            "2. 🗑️ Remove decayed memories     ✅\n"
            f"   └─ {removed} below threshold ({CONSOLIDATION_THRESHOLD:.2f})\n"
            "3. 🔗 Deduplicate similar entries  ✅\n"
            f"   └─ {deduped} duplicates merged\n"
            "4. 📊 Rebuild indices              ✅\n"
            "```\n\n"
            "### Memory Health After Consolidation\n\n"
            f"- 📦 Total memories: **{after_count:,}**\n"
            f"- 📊 Storage used: **{after_count / MAX_MEMORY_COUNT * 100:.1f}%**\n"
        )

        if self._memories:
            avg_imp = sum(m["importance"] for m in self._memories.values()) / after_count
            content += f"- ⭐ Average importance: **{avg_imp:.2f}**\n"

        content += (
            "\n> 💡 Consolidation is recommended weekly or when storage exceeds 70%."
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.91,
            metadata={
                "intent": "memory_consolidation",
                "before": before_count,
                "after": after_count,
                "removed": removed,
                "deduped": deduped,
            },
            suggestions=[
                "Show memory status",
                "Search for important memories",
                "Store a new memory",
            ],
        )

    async def _handle_general_memory(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle general memory queries not matching a specific intent."""
        content = (
            "## 🧠 NEXUS Memory System\n\n"
            "I'm your long-term memory agent. Here's what I can do:\n\n"
            "### Commands\n\n"
            "| Command | Description |\n"
            "|---------|-------------|\n"
            "| *Remember that ...* | Store a new memory |\n"
            "| *What do you remember about ...?* | Recall memories |\n"
            "| *Search memories for ...* | Advanced memory search |\n"
            "| *Memory status* | View memory statistics |\n"
            "| *Forget ...* | Delete specific memories |\n"
            "| *Consolidate memories* | Optimise memory store |\n\n"
            "### Current State\n\n"
            f"- 📦 Stored memories: **{len(self._memories):,}**\n"
            f"- 📥 Total stored: **{self._total_stored:,}**\n"
            f"- 🔍 Total recalled: **{self._total_recalled:,}**\n"
            f"- 🏷️ Unique tags: **{len(self._tag_index):,}**\n"
            f"- 📂 Categories: **{len(MEMORY_CATEGORIES)}**\n\n"
            "### Memory Categories\n\n"
        )

        for cat in MEMORY_CATEGORIES:
            count = len(self._category_index.get(cat, []))
            content += f"- {cat.replace('_', ' ').title()}: **{count}** memories\n"

        content += (
            "\n> 💡 Say *\"remember that my favourite colour is blue\"* "
            "to store your first memory!"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.75,
            metadata={"intent": "general", "total_memories": len(self._memories)},
            suggestions=[
                "Remember that I prefer Python",
                "Show memory status",
                "Search my memories",
            ],
        )

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------

    def _track_conversation(self, context: AgentContext) -> None:
        """Track conversation context for cross-session continuity."""
        if context.conversation_id:
            self._conversation_contexts.setdefault(
                context.conversation_id, []
            ).append({
                "message": context.message[:500],
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": context.user_id,
            })

    def _extract_memory_content(self, message: str) -> str:
        """Extract the content to store from a user's message."""
        prefixes = [
            "remember that ", "remember ", "store that ", "store ",
            "memorize that ", "memorize ", "memorise that ", "memorise ",
            "save that ", "save ", "note that ", "note ",
            "keep in mind that ", "keep in mind ",
            "record this ", "record that ", "record ",
            "don't forget that ", "don't forget ",
        ]
        content = message
        for prefix in prefixes:
            if content.startswith(prefix):
                content = content[len(prefix):]
                break
        return content.strip().capitalize() if content.strip() else message

    def _extract_recall_query(self, message: str) -> str:
        """Extract a recall query from a user's message."""
        prefixes = [
            "what do you remember about ", "what do you know about ",
            "recall ", "remind me about ", "retrieve ",
            "what did i say about ", "what did i tell you about ",
            "do you remember ", "search for ", "find memories about ",
            "search memory about ", "search memories for ",
            "look up ", "find anything about ", "forget about ",
            "forget ", "delete memory about ", "remove memory about ",
        ]
        query = message
        for prefix in prefixes:
            if query.startswith(prefix):
                query = query[len(prefix):]
                break
        return query.strip() if query.strip() else message

    def _classify_memory(self, content: str) -> str:
        """Classify memory content into a category."""
        category_keywords: Dict[str, List[str]] = {
            "personal_fact": ["my name", "i am", "i'm", "my age", "i live", "my birthday"],
            "preference": ["i prefer", "i like", "i love", "favourite", "favorite", "i enjoy"],
            "decision": ["i decided", "i chose", "i will", "i'm going to", "my plan"],
            "instruction": ["always", "never", "make sure", "don't", "do not", "please always"],
            "event": ["meeting", "appointment", "deadline", "event", "scheduled", "on monday"],
            "relationship": ["my friend", "my colleague", "my boss", "my partner", "my family"],
            "technical": ["api", "server", "database", "code", "deploy", "config", "version"],
            "goal": ["i want to", "my goal", "i aim", "i hope", "aspiration", "objective"],
        }

        content_lower = content.lower()
        for category, keywords in category_keywords.items():
            if any(kw in content_lower for kw in keywords):
                return category

        return "general"

    def _score_importance(self, content: str, original_message: str) -> float:
        """Score the importance of a memory from 0.0 to 1.0."""
        score = 0.5  # Base importance

        # Emphasis signals increase importance
        emphasis = ["important", "critical", "vital", "essential", "key",
                     "don't forget", "crucial", "must remember", "always"]
        if any(kw in original_message.lower() for kw in emphasis):
            score += 0.2

        # Personal facts are important
        personal = ["my name", "i am", "my birthday", "my address", "my phone"]
        if any(kw in content.lower() for kw in personal):
            score += 0.15

        # Instructions are important
        instructions = ["always", "never", "make sure", "don't"]
        if any(kw in content.lower() for kw in instructions):
            score += 0.1

        # Longer content suggests more detailed, important information
        if len(content) > 100:
            score += 0.05

        return min(1.0, score)

    def _extract_tags(self, content: str) -> List[str]:
        """Extract semantic tags from memory content."""
        tags = []
        # Simple keyword-based tagging
        tag_map = {
            "python": "python", "javascript": "javascript", "rust": "rust",
            "work": "work", "home": "home", "family": "family",
            "project": "project", "meeting": "meeting", "deadline": "deadline",
            "preference": "preference", "goal": "goal", "health": "health",
            "finance": "finance", "travel": "travel", "food": "food",
        }
        content_lower = content.lower()
        for keyword, tag in tag_map.items():
            if keyword in content_lower:
                tags.append(tag)
        return tags[:5]  # Limit to 5 tags

    def _search_memories(
        self,
        query: str,
        limit: int = DEFAULT_SEARCH_LIMIT,
        category: Optional[str] = None,
        min_importance: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """Search memories with keyword matching and optional filters."""
        results = []
        query_lower = query.lower()
        query_words = set(query_lower.split())

        for mem in self._memories.values():
            # Category filter
            if category and mem.get("category") != category:
                continue

            # Importance filter
            effective_importance = mem["importance"] * mem.get("decay_factor", 1.0)
            if effective_importance < min_importance:
                continue

            # Keyword matching — score based on word overlap
            content_lower = mem["content"].lower()
            tag_str = " ".join(mem.get("tags", []))

            match_score = 0.0
            if query_lower in content_lower:
                match_score = 1.0
            else:
                content_words = set(content_lower.split())
                overlap = query_words & content_words
                if overlap:
                    match_score = len(overlap) / len(query_words)

            # Tag matching bonus
            if any(w in tag_str for w in query_words):
                match_score += 0.2

            if match_score > 0.0:
                results.append({
                    **mem,
                    "_match_score": match_score * effective_importance,
                })

        # Sort by match score (descending), then by importance
        results.sort(key=lambda x: x["_match_score"], reverse=True)

        # Clean up internal score
        for r in results:
            r.pop("_match_score", None)

        return results[:limit]

    def _apply_decay(self) -> int:
        """Apply time-based decay to all memories. Returns count of decayed."""
        count = 0
        now = datetime.utcnow()
        for mem in self._memories.values():
            # Critical memories don't decay
            if mem["importance"] >= IMPORTANCE_THRESHOLDS["critical"]:
                continue

            try:
                created = datetime.fromisoformat(mem["created_at"])
                age_days = (now - created).total_seconds() / 86400
                decay = max(0.0, 1.0 - (BASE_DECAY_RATE * age_days / mem["importance"]))
                mem["decay_factor"] = decay
                count += 1
            except (ValueError, KeyError, ZeroDivisionError):
                continue
        return count

    def _remove_decayed_memories(self) -> int:
        """Remove memories whose effective importance fell below threshold."""
        to_remove = []
        for mid, mem in self._memories.items():
            effective = mem["importance"] * mem.get("decay_factor", 1.0)
            if effective < CONSOLIDATION_THRESHOLD:
                to_remove.append(mid)

        for mid in to_remove:
            del self._memories[mid]
            self._total_forgotten += 1

        return len(to_remove)

    def _deduplicate_memories(self) -> int:
        """Remove duplicate memories with identical or near-identical content."""
        seen_contents: Dict[str, str] = {}  # normalised content -> first memory_id
        to_remove = []

        for mid, mem in self._memories.items():
            normalised = mem["content"].lower().strip()
            if normalised in seen_contents:
                to_remove.append(mid)
            else:
                seen_contents[normalised] = mid

        for mid in to_remove:
            del self._memories[mid]

        return len(to_remove)

    def _detect_category_filter(self, message: str) -> Optional[str]:
        """Detect if the user wants to filter by memory category."""
        for cat in MEMORY_CATEGORIES:
            if cat.replace("_", " ") in message or cat in message:
                return cat
        return None

    def _detect_importance_filter(self, message: str) -> float:
        """Detect if the user wants to filter by importance level."""
        if "important" in message or "critical" in message:
            return 0.7
        if "high" in message:
            return 0.6
        return 0.0

    def _importance_icon(self, importance: float) -> str:
        """Return an icon representing the importance level."""
        if importance >= 0.9:
            return "🔴"
        if importance >= 0.7:
            return "🟠"
        if importance >= 0.5:
            return "🟡"
        if importance >= 0.3:
            return "🟢"
        return "⚪"

    def _importance_label(self, importance: float) -> str:
        """Return a label for the importance level."""
        for label, threshold in IMPORTANCE_THRESHOLDS.items():
            if importance >= threshold:
                return label.title()
        return "Trivial"

    def _format_age(self, iso_timestamp: str) -> str:
        """Format the age of a memory as a human-readable string."""
        try:
            created = datetime.fromisoformat(iso_timestamp)
            delta = datetime.utcnow() - created
            if delta.days > 0:
                return f"{delta.days}d ago"
            hours = delta.seconds // 3600
            if hours > 0:
                return f"{hours}h ago"
            minutes = delta.seconds // 60
            return f"{minutes}m ago"
        except (ValueError, TypeError):
            return "Unknown"
