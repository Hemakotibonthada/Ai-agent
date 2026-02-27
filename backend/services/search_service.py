"""
Search Service
Features: Full-text search, fuzzy matching, filters, faceted search,
          search suggestions, recent searches, search analytics
"""
from __future__ import annotations

import asyncio
import math
import re
import time
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from services.demo_data_manager import is_demo_data_enabled


class SearchIndex(str, Enum):
    TASKS = "tasks"
    MESSAGES = "messages"
    AGENTS = "agents"
    DEVICES = "devices"
    HEALTH = "health"
    FINANCE = "finance"
    FILES = "files"
    NOTES = "notes"
    SETTINGS = "settings"
    LOGS = "logs"
    ALL = "all"


class SortOrder(str, Enum):
    RELEVANCE = "relevance"
    DATE_ASC = "date_asc"
    DATE_DESC = "date_desc"
    ALPHABETICAL = "alphabetical"
    POPULARITY = "popularity"


@dataclass
class SearchDocument:
    id: str
    index: SearchIndex
    title: str
    content: str
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    boost: float = 1.0
    url: str = ""
    icon: str = ""
    category: str = ""

    @property
    def searchable_text(self) -> str:
        parts = [self.title, self.content]
        parts.extend(self.tags)
        parts.append(self.category)
        for v in self.metadata.values():
            if isinstance(v, str):
                parts.append(v)
        return " ".join(parts).lower()


@dataclass
class SearchFilter:
    index: Optional[SearchIndex] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    date_from: Optional[float] = None
    date_to: Optional[float] = None
    metadata_filters: Optional[Dict[str, Any]] = None


@dataclass
class SearchResult:
    document: SearchDocument
    score: float
    highlights: List[str] = field(default_factory=list)
    matched_terms: List[str] = field(default_factory=list)


@dataclass
class SearchResponse:
    results: List[SearchResult]
    total: int
    page: int
    page_size: int
    query: str
    took_ms: float
    facets: Dict[str, Dict[str, int]] = field(default_factory=dict)
    suggestions: List[str] = field(default_factory=list)
    did_you_mean: Optional[str] = None


class InvertedIndex:
    """Simple inverted index for full-text search."""

    def __init__(self):
        self._index: Dict[str, Dict[str, float]] = {}
        self._doc_lengths: Dict[str, int] = {}
        self._avg_doc_length: float = 0
        self._total_docs: int = 0
        self._stop_words: Set[str] = {
            "a", "an", "and", "are", "as", "at", "be", "but", "by", "for",
            "if", "in", "into", "is", "it", "no", "not", "of", "on", "or",
            "such", "that", "the", "their", "then", "there", "these", "they",
            "this", "to", "was", "will", "with",
        }

    def tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r"\b\w+\b", text.lower())
        return [t for t in tokens if t not in self._stop_words and len(t) > 1]

    def add_document(self, doc_id: str, text: str, boost: float = 1.0):
        tokens = self.tokenize(text)
        self._doc_lengths[doc_id] = len(tokens)
        self._total_docs += 1
        self._avg_doc_length = (
            sum(self._doc_lengths.values()) / self._total_docs
            if self._total_docs > 0
            else 0
        )

        term_freq = Counter(tokens)
        for term, count in term_freq.items():
            if term not in self._index:
                self._index[term] = {}
            tf = count / len(tokens) if tokens else 0
            self._index[term][doc_id] = tf * boost

    def remove_document(self, doc_id: str):
        if doc_id in self._doc_lengths:
            del self._doc_lengths[doc_id]
            self._total_docs -= 1
            for term in list(self._index.keys()):
                if doc_id in self._index[term]:
                    del self._index[term][doc_id]
                    if not self._index[term]:
                        del self._index[term]

    def search(self, query: str, limit: int = 50) -> List[Tuple[str, float]]:
        """BM25-like scoring search."""
        tokens = self.tokenize(query)
        if not tokens:
            return []

        scores: Dict[str, float] = defaultdict(float)
        k1 = 1.2
        b = 0.75

        for term in tokens:
            if term not in self._index:
                continue
            posting = self._index[term]
            df = len(posting)
            idf = math.log(
                (self._total_docs - df + 0.5) / (df + 0.5) + 1
            )

            for doc_id, tf in posting.items():
                doc_len = self._doc_lengths.get(doc_id, 0)
                norm_tf = (
                    (tf * (k1 + 1))
                    / (tf + k1 * (1 - b + b * doc_len / self._avg_doc_length))
                    if self._avg_doc_length > 0
                    else tf
                )
                scores[doc_id] += idf * norm_tf

        sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_results[:limit]

    def suggest(self, prefix: str, limit: int = 10) -> List[str]:
        prefix_lower = prefix.lower()
        matches = [
            term
            for term in self._index
            if term.startswith(prefix_lower)
        ]
        matches.sort(
            key=lambda t: len(self._index.get(t, {})), reverse=True
        )
        return matches[:limit]


class SearchService:
    """
    Full-text search service with BM25 ranking.

    Features:
    - Full-text search with BM25 scoring
    - Fuzzy matching with Levenshtein distance
    - Faceted search with aggregations
    - Search suggestions and autocomplete
    - Recent searches tracking
    - Search analytics
    - Multi-index support
    - Highlight matching terms
    - Pagination
    - Real-time indexing
    """

    def __init__(self):
        self._documents: Dict[str, SearchDocument] = {}
        self._indexes: Dict[SearchIndex, InvertedIndex] = {}
        self._global_index = InvertedIndex()
        self._recent_searches: List[Dict[str, Any]] = []
        self._popular_searches: Counter = Counter()
        self._search_history: List[Dict[str, Any]] = []
        self._synonyms: Dict[str, List[str]] = {
            "task": ["todo", "item", "work", "assignment"],
            "health": ["medical", "wellness", "fitness"],
            "finance": ["money", "budget", "expense", "income"],
            "home": ["house", "smart", "device", "iot"],
            "message": ["chat", "text", "communication"],
        }
        if is_demo_data_enabled():
            self._init_sample_data()

    def _init_sample_data(self):
        """Populate search index with sample documents."""
        sample_docs = [
            SearchDocument(
                id="task-001", index=SearchIndex.TASKS,
                title="Complete project proposal",
                content="Draft and submit the Q4 project proposal for the AI enhancement initiative",
                tags=["work", "deadline", "high-priority"],
                category="Work", icon="briefcase", url="/tasks",
            ),
            SearchDocument(
                id="task-002", index=SearchIndex.TASKS,
                title="Schedule dentist appointment",
                content="Book a dental checkup for next week, preferably morning slot",
                tags=["health", "personal"],
                category="Personal", icon="calendar", url="/tasks",
            ),
            SearchDocument(
                id="task-003", index=SearchIndex.TASKS,
                title="Review budget report",
                content="Analyze monthly spending report and identify areas for savings",
                tags=["finance", "review"],
                category="Finance", icon="dollar-sign", url="/finance",
            ),
            SearchDocument(
                id="agent-001", index=SearchIndex.AGENTS,
                title="Personal Assistant Agent",
                content="AI agent for personal scheduling, reminders, and daily planning",
                tags=["ai", "assistant", "scheduling"],
                category="AI Agents", icon="bot", url="/agents",
            ),
            SearchDocument(
                id="agent-002", index=SearchIndex.AGENTS,
                title="Security Monitor Agent",
                content="Monitors network traffic, intrusion detection, and security alerts",
                tags=["security", "monitoring", "network"],
                category="AI Agents", icon="shield", url="/agents",
            ),
            SearchDocument(
                id="device-001", index=SearchIndex.DEVICES,
                title="Living Room Thermostat",
                content="Smart thermostat controlling temperature and humidity in the living room",
                tags=["iot", "temperature", "smart-home"],
                category="Smart Home", icon="thermometer", url="/home",
            ),
            SearchDocument(
                id="device-002", index=SearchIndex.DEVICES,
                title="Front Door Camera",
                content="Security camera at the front door with motion detection and night vision",
                tags=["security", "camera", "motion"],
                category="Smart Home", icon="camera", url="/home",
            ),
            SearchDocument(
                id="health-001", index=SearchIndex.HEALTH,
                title="Weekly health summary",
                content="Average heart rate 72bpm, sleep quality 85%, 8500 daily steps, BMI 23.5",
                tags=["health", "weekly", "summary"],
                category="Health", icon="heart", url="/health",
            ),
            SearchDocument(
                id="health-002", index=SearchIndex.HEALTH,
                title="Medication reminder",
                content="Take vitamin D supplement 1000IU daily with breakfast",
                tags=["health", "medication", "reminder"],
                category="Health", icon="pill", url="/health",
            ),
            SearchDocument(
                id="finance-001", index=SearchIndex.FINANCE,
                title="Monthly budget overview",
                content="Total income $8,500, expenses $5,200, savings $3,300, investment $1,500",
                tags=["finance", "budget", "monthly"],
                category="Finance", icon="wallet", url="/finance",
            ),
            SearchDocument(
                id="finance-002", index=SearchIndex.FINANCE,
                title="Investment portfolio update",
                content="Portfolio value $45,000, YTD return 12.5%, diversification across stocks bonds and ETFs",
                tags=["finance", "investment", "portfolio"],
                category="Finance", icon="trending-up", url="/finance",
            ),
            SearchDocument(
                id="note-001", index=SearchIndex.NOTES,
                title="Meeting notes - Q4 planning",
                content="Discussed roadmap priorities, resource allocation, and timeline for new features. Action items assigned to team leads.",
                tags=["meeting", "planning", "work"],
                category="Notes", icon="file-text", url="/notes",
            ),
            SearchDocument(
                id="note-002", index=SearchIndex.NOTES,
                title="Recipe - Pasta carbonara",
                content="Ingredients: spaghetti, eggs, pancetta, parmesan, black pepper. Cook pasta al dente, mix with egg mixture off heat.",
                tags=["recipe", "cooking", "personal"],
                category="Notes", icon="file-text", url="/notes",
            ),
            SearchDocument(
                id="log-001", index=SearchIndex.LOGS,
                title="System startup log",
                content="All services started successfully. 15 agents initialized, 12 services running. Memory usage: 256MB.",
                tags=["system", "startup", "log"],
                category="System", icon="terminal", url="/settings",
            ),
            SearchDocument(
                id="file-001", index=SearchIndex.FILES,
                title="Project presentation.pptx",
                content="Q4 project presentation with 25 slides covering features, timeline, and budget breakdown",
                tags=["presentation", "work", "project"],
                category="Files", icon="file", url="/files",
                metadata={"size": "4.2MB", "type": "PowerPoint"},
            ),
        ]

        for doc in sample_docs:
            self.index_document(doc)

    def index_document(self, doc: SearchDocument) -> None:
        """Add or update a document in the search index."""
        self._documents[doc.id] = doc

        if doc.index not in self._indexes:
            self._indexes[doc.index] = InvertedIndex()

        text = doc.searchable_text
        self._indexes[doc.index].add_document(doc.id, text, doc.boost)
        self._global_index.add_document(doc.id, text, doc.boost)

    def remove_document(self, doc_id: str) -> bool:
        """Remove a document from all indexes."""
        doc = self._documents.pop(doc_id, None)
        if not doc:
            return False

        if doc.index in self._indexes:
            self._indexes[doc.index].remove_document(doc_id)
        self._global_index.remove_document(doc_id)
        return True

    async def search(
        self,
        query: str,
        filters: Optional[SearchFilter] = None,
        sort: SortOrder = SortOrder.RELEVANCE,
        page: int = 1,
        page_size: int = 20,
        fuzzy: bool = True,
        include_facets: bool = True,
    ) -> SearchResponse:
        """Perform a full-text search."""
        start_time = time.time()

        self._popular_searches[query] += 1
        self._recent_searches.append({
            "query": query,
            "timestamp": time.time(),
            "filters": filters.__dict__ if filters else None,
        })
        if len(self._recent_searches) > 100:
            self._recent_searches = self._recent_searches[-100:]

        expanded_query = self._expand_query(query)

        target_index = self._global_index
        if filters and filters.index and filters.index != SearchIndex.ALL:
            target_index = self._indexes.get(filters.index, self._global_index)

        raw_results = target_index.search(expanded_query, limit=200)

        results: List[SearchResult] = []
        for doc_id, score in raw_results:
            doc = self._documents.get(doc_id)
            if not doc:
                continue

            if filters:
                if not self._matches_filters(doc, filters):
                    continue

            highlights = self._generate_highlights(doc, query)
            matched_terms = self._get_matched_terms(doc, query)

            results.append(SearchResult(
                document=doc,
                score=score,
                highlights=highlights,
                matched_terms=matched_terms,
            ))

        if fuzzy and len(results) < 5:
            fuzzy_results = self._fuzzy_search(query, filters)
            existing_ids = {r.document.id for r in results}
            for fr in fuzzy_results:
                if fr.document.id not in existing_ids:
                    results.append(fr)

        results = self._sort_results(results, sort)

        facets = {}
        if include_facets:
            facets = self._compute_facets(results)

        total = len(results)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_results = results[start_idx:end_idx]

        suggestions = self._get_suggestions(query)
        did_you_mean = self._did_you_mean(query) if not results else None

        took_ms = (time.time() - start_time) * 1000

        return SearchResponse(
            results=paged_results,
            total=total,
            page=page,
            page_size=page_size,
            query=query,
            took_ms=round(took_ms, 2),
            facets=facets,
            suggestions=suggestions,
            did_you_mean=did_you_mean,
        )

    async def suggest(self, prefix: str, limit: int = 10) -> List[str]:
        """Get search suggestions for a prefix."""
        return self._global_index.suggest(prefix, limit)

    async def get_recent_searches(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent search history."""
        return self._recent_searches[-limit:][::-1]

    async def get_popular_searches(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get most popular searches."""
        return [
            {"query": q, "count": c}
            for q, c in self._popular_searches.most_common(limit)
        ]

    async def get_search_stats(self) -> Dict[str, Any]:
        """Get search system statistics."""
        return {
            "total_documents": len(self._documents),
            "indexes": {
                idx.value: len([
                    d for d in self._documents.values() if d.index == idx
                ])
                for idx in SearchIndex
                if idx != SearchIndex.ALL
            },
            "total_searches": sum(self._popular_searches.values()),
            "unique_searches": len(self._popular_searches),
            "recent_searches_count": len(self._recent_searches),
        }

    def _expand_query(self, query: str) -> str:
        """Expand query with synonyms."""
        words = query.lower().split()
        expanded = list(words)
        for word in words:
            if word in self._synonyms:
                expanded.extend(self._synonyms[word])
        return " ".join(expanded)

    def _matches_filters(self, doc: SearchDocument, filters: SearchFilter) -> bool:
        """Check if a document matches the given filters."""
        if filters.tags:
            if not any(t in doc.tags for t in filters.tags):
                return False
        if filters.category and doc.category.lower() != filters.category.lower():
            return False
        if filters.date_from and doc.created_at < filters.date_from:
            return False
        if filters.date_to and doc.created_at > filters.date_to:
            return False
        if filters.metadata_filters:
            for key, value in filters.metadata_filters.items():
                if doc.metadata.get(key) != value:
                    return False
        return True

    def _generate_highlights(self, doc: SearchDocument, query: str) -> List[str]:
        """Generate highlighted snippets."""
        words = query.lower().split()
        content = doc.content
        highlights = []

        for word in words:
            pattern = re.compile(re.escape(word), re.IGNORECASE)
            for match in pattern.finditer(content):
                start = max(0, match.start() - 40)
                end = min(len(content), match.end() + 40)
                snippet = content[start:end]
                if start > 0:
                    snippet = "..." + snippet
                if end < len(content):
                    snippet += "..."
                highlighted = pattern.sub(f"**{match.group()}**", snippet)
                highlights.append(highlighted)

        return highlights[:3]

    def _get_matched_terms(self, doc: SearchDocument, query: str) -> List[str]:
        """Get which query terms matched the document."""
        words = query.lower().split()
        text = doc.searchable_text
        return [w for w in words if w in text]

    def _fuzzy_search(
        self, query: str, filters: Optional[SearchFilter]
    ) -> List[SearchResult]:
        """Fuzzy matching using edit distance."""
        words = query.lower().split()
        results = []

        for doc in self._documents.values():
            if filters and not self._matches_filters(doc, filters):
                continue

            score = 0
            text = doc.searchable_text
            text_words = set(text.split())

            for query_word in words:
                for text_word in text_words:
                    dist = self._levenshtein(query_word, text_word)
                    max_len = max(len(query_word), len(text_word))
                    if max_len > 0 and dist / max_len < 0.4:
                        score += (1 - dist / max_len) * 0.5

            if score > 0:
                results.append(SearchResult(
                    document=doc,
                    score=score,
                    highlights=[],
                    matched_terms=[],
                ))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:10]

    def _levenshtein(self, s1: str, s2: str) -> int:
        """Compute Levenshtein edit distance."""
        if len(s1) < len(s2):
            return self._levenshtein(s2, s1)
        if len(s2) == 0:
            return len(s1)

        prev_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            curr_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = prev_row[j + 1] + 1
                deletions = curr_row[j] + 1
                substitutions = prev_row[j] + (c1 != c2)
                curr_row.append(min(insertions, deletions, substitutions))
            prev_row = curr_row

        return prev_row[-1]

    def _sort_results(
        self, results: List[SearchResult], sort: SortOrder
    ) -> List[SearchResult]:
        """Sort search results."""
        if sort == SortOrder.RELEVANCE:
            results.sort(key=lambda r: r.score, reverse=True)
        elif sort == SortOrder.DATE_DESC:
            results.sort(key=lambda r: r.document.created_at, reverse=True)
        elif sort == SortOrder.DATE_ASC:
            results.sort(key=lambda r: r.document.created_at)
        elif sort == SortOrder.ALPHABETICAL:
            results.sort(key=lambda r: r.document.title.lower())
        return results

    def _compute_facets(self, results: List[SearchResult]) -> Dict[str, Dict[str, int]]:
        """Compute faceted aggregations."""
        facets: Dict[str, Dict[str, int]] = {
            "category": defaultdict(int),
            "index": defaultdict(int),
            "tags": defaultdict(int),
        }
        for r in results:
            facets["category"][r.document.category] += 1
            facets["index"][r.document.index.value] += 1
            for tag in r.document.tags:
                facets["tags"][tag] += 1
        return {k: dict(v) for k, v in facets.items()}

    def _get_suggestions(self, query: str) -> List[str]:
        """Get search suggestions based on the query."""
        words = query.lower().split()
        if not words:
            return []
        last_word = words[-1]
        completions = self._global_index.suggest(last_word, 5)
        prefix = " ".join(words[:-1])
        return [f"{prefix} {c}".strip() for c in completions if c != last_word]

    def _did_you_mean(self, query: str) -> Optional[str]:
        """Suggest a corrected query."""
        words = query.lower().split()
        corrected = []
        changed = False

        all_terms = list(self._global_index._index.keys())
        for word in words:
            if word in self._global_index._index:
                corrected.append(word)
            else:
                best_match = None
                best_dist = float("inf")
                for term in all_terms:
                    dist = self._levenshtein(word, term)
                    if dist < best_dist and dist <= 2:
                        best_dist = dist
                        best_match = term
                if best_match:
                    corrected.append(best_match)
                    changed = True
                else:
                    corrected.append(word)

        return " ".join(corrected) if changed else None


# ── Singleton ─────────────────────────────────────────────────────────
_search_service: Optional[SearchService] = None

def get_search_service() -> SearchService:
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service
