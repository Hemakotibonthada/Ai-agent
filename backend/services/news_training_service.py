# NEXUS AI - News Training Service
"""
Self-training news pipeline that continuously fetches, processes,
and learns from the latest news and information.  Feeds into the
NEXUS knowledge base so the assistant stays up-to-date.
"""

import asyncio
import hashlib
import json
import math
import os
import re
import time
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger

from core.config import settings
from core.events import Event, EventCategory, EventPriority, event_bus


# =====================================================================
# Enums
# =====================================================================

class NewsCategory(str, Enum):
    TECH = "tech"
    WORLD = "world"
    BUSINESS = "business"
    SCIENCE = "science"
    HEALTH = "health"
    SPORTS = "sports"
    ENTERTAINMENT = "entertainment"
    POLITICS = "politics"
    GENERAL = "general"


class SourceStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"


class ArticleStatus(str, Enum):
    FETCHED = "fetched"
    PROCESSED = "processed"
    EMBEDDED = "embedded"
    TRAINED = "trained"
    FAILED = "failed"


# =====================================================================
# Data models
# =====================================================================

@dataclass
class NewsSource:
    """An RSS/Atom feed source definition."""
    source_id: str
    name: str
    url: str
    category: NewsCategory = NewsCategory.GENERAL
    status: SourceStatus = SourceStatus.ACTIVE
    reliability_score: float = 0.8
    fetch_interval_minutes: int = 120
    last_fetched: Optional[datetime] = None
    last_error: Optional[str] = None
    articles_fetched: int = 0
    consecutive_errors: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "name": self.name,
            "url": self.url,
            "category": self.category.value,
            "status": self.status.value,
            "reliability_score": round(self.reliability_score, 2),
            "fetch_interval_minutes": self.fetch_interval_minutes,
            "last_fetched": self.last_fetched.isoformat() if self.last_fetched else None,
            "last_error": self.last_error,
            "articles_fetched": self.articles_fetched,
        }


@dataclass
class NewsArticle:
    """A fetched and processed news article."""
    article_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str = ""
    title: str = ""
    url: str = ""
    author: str = ""
    published_at: Optional[datetime] = None
    fetched_at: datetime = field(default_factory=datetime.utcnow)
    content: str = ""
    summary: str = ""
    keywords: List[str] = field(default_factory=list)
    category: NewsCategory = NewsCategory.GENERAL
    status: ArticleStatus = ArticleStatus.FETCHED
    content_hash: str = ""
    word_count: int = 0
    sentiment_score: float = 0.0
    relevance_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "article_id": self.article_id,
            "source_id": self.source_id,
            "title": self.title,
            "url": self.url,
            "author": self.author,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "fetched_at": self.fetched_at.isoformat(),
            "summary": self.summary,
            "keywords": self.keywords,
            "category": self.category.value,
            "status": self.status.value,
            "word_count": self.word_count,
            "sentiment_score": round(self.sentiment_score, 3),
            "relevance_score": round(self.relevance_score, 3),
        }


@dataclass
class TrendEntry:
    """Tracks a trending keyword / topic over time."""
    keyword: str
    first_seen: datetime = field(default_factory=datetime.utcnow)
    last_seen: datetime = field(default_factory=datetime.utcnow)
    occurrences: int = 1
    velocity: float = 0.0  # growth rate
    associated_articles: List[str] = field(default_factory=list)  # article IDs


@dataclass
class NewsDigest:
    """A compiled news digest."""
    digest_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    period: str = "daily"
    generated_at: datetime = field(default_factory=datetime.utcnow)
    categories: Dict[str, List[Dict[str, str]]] = field(default_factory=dict)
    top_stories: List[Dict[str, str]] = field(default_factory=list)
    trending_topics: List[str] = field(default_factory=list)
    total_articles: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "digest_id": self.digest_id,
            "period": self.period,
            "generated_at": self.generated_at.isoformat(),
            "categories": self.categories,
            "top_stories": self.top_stories,
            "trending_topics": self.trending_topics,
            "total_articles": self.total_articles,
        }


# =====================================================================
# Default news sources
# =====================================================================

DEFAULT_SOURCES: List[Dict[str, Any]] = [
    {"name": "BBC News - Top Stories", "url": "http://feeds.bbci.co.uk/news/rss.xml",
     "category": "world"},
    {"name": "BBC News - Technology", "url": "http://feeds.bbci.co.uk/news/technology/rss.xml",
     "category": "tech"},
    {"name": "Reuters - World", "url": "https://feeds.reuters.com/reuters/worldNews",
     "category": "world"},
    {"name": "Reuters - Technology", "url": "https://feeds.reuters.com/reuters/technologyNews",
     "category": "tech"},
    {"name": "Reuters - Business", "url": "https://feeds.reuters.com/reuters/businessNews",
     "category": "business"},
    {"name": "TechCrunch", "url": "https://techcrunch.com/feed/",
     "category": "tech"},
    {"name": "Hacker News - Best", "url": "https://hnrss.org/best",
     "category": "tech"},
    {"name": "Science Daily", "url": "https://www.sciencedaily.com/rss/all.xml",
     "category": "science"},
    {"name": "ESPN - Top", "url": "https://www.espn.com/espn/rss/news",
     "category": "sports"},
    {"name": "WHO - Disease Outbreak News", "url": "https://www.who.int/feeds/entity/don/en/rss.xml",
     "category": "health"},
]

# Category classification keywords
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "tech": ["software", "hardware", "ai", "artificial intelligence", "startup",
             "app", "cyber", "blockchain", "cloud", "data", "machine learning",
             "programming", "developer", "tech", "digital", "internet", "robot"],
    "business": ["market", "stock", "economy", "trade", "revenue", "profit",
                 "investment", "ceo", "company", "merger", "acquisition", "gdp",
                 "inflation", "banking", "finance", "earnings"],
    "science": ["research", "study", "discovery", "space", "nasa", "physics",
                "biology", "chemistry", "experiment", "climate", "evolution",
                "genome", "quantum", "telescope", "fossil"],
    "health": ["health", "medical", "vaccine", "disease", "hospital", "drug",
               "treatment", "patient", "clinical", "mental health", "pandemic",
               "nutrition", "fitness", "surgery", "diagnosis"],
    "sports": ["game", "match", "tournament", "league", "championship", "score",
               "player", "team", "coach", "olympic", "football", "basketball",
               "soccer", "tennis", "cricket", "nfl", "nba"],
    "world": ["government", "election", "war", "peace", "treaty", "diplomacy",
              "united nations", "refugee", "protest", "policy", "sanctions",
              "conflict", "crisis", "humanitarian"],
}

# Stop words for keyword extraction
STOP_WORDS: Set[str] = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "about", "up",
    "it", "its", "this", "that", "these", "those", "i", "me", "my",
    "we", "our", "you", "your", "he", "him", "his", "she", "her",
    "they", "them", "their", "what", "which", "who", "whom",
    "said", "also", "new", "one", "two", "first", "last", "many",
}


# =====================================================================
# News Training Service
# =====================================================================

class NewsTrainingService:
    """
    Self-training news pipeline for NEXUS AI.

    Provides:
    - Multi-source RSS feed fetching and scheduling
    - Content processing: summarisation, keyword extraction, classification
    - Deduplicated knowledge store with content hashing
    - Trend detection and topic clustering
    - Periodic background fetching (configurable interval)
    - Daily / weekly news digest generation
    - Source management (add / remove / enable / disable)
    - Full-text and semantic search across stored articles
    - Self-training prompt generation from new knowledge
    - Statistics and monitoring
    """

    def __init__(self):
        self._initialized: bool = False
        self._data_dir: Path = Path(
            getattr(settings, "database", None)
            and getattr(settings.database, "db_path", "data")
            or "data"
        ).parent / "news"
        self._articles_dir: Path = self._data_dir / "articles"
        self._digests_dir: Path = self._data_dir / "digests"
        self._sources: Dict[str, NewsSource] = {}
        self._articles: Dict[str, NewsArticle] = {}
        self._content_hashes: Set[str] = set()
        self._trends: Dict[str, TrendEntry] = {}
        self._keyword_counts: Counter = Counter()
        self._fetch_interval_seconds: int = 7200  # default 2 hours
        self._fetch_task: Optional[asyncio.Task] = None
        self._user_interests: List[str] = []
        self._last_fetch_time: Optional[datetime] = None
        self._total_articles_processed: int = 0
        self._total_fetch_errors: int = 0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialise the news training service."""
        if self._initialized:
            return

        logger.info("Initialising NewsTrainingService …")

        # Ensure directories
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._articles_dir.mkdir(parents=True, exist_ok=True)
        self._digests_dir.mkdir(parents=True, exist_ok=True)

        # Load default sources
        for src_def in DEFAULT_SOURCES:
            sid = hashlib.md5(src_def["url"].encode()).hexdigest()[:12]
            if sid not in self._sources:
                self._sources[sid] = NewsSource(
                    source_id=sid,
                    name=src_def["name"],
                    url=src_def["url"],
                    category=NewsCategory(src_def["category"]),
                )

        # Restore persisted state
        await self._load_state()

        # Subscribe to relevant events
        await event_bus.subscribe(
            "news_training_service",
            "news.*",
            self._handle_event,
        )

        self._initialized = True
        logger.info(
            "NewsTrainingService ready – {} sources, {} cached articles",
            len(self._sources), len(self._articles),
        )

        # Emit initialisation event
        await event_bus.publish(Event(
            event_type="news.service.initialized",
            data={"sources": len(self._sources), "articles": len(self._articles)},
            category=EventCategory.TRAINING,
            priority=EventPriority.NORMAL,
            source="news_training_service",
        ))

    async def start_background_fetching(self) -> None:
        """Start the periodic background fetch loop."""
        if self._fetch_task and not self._fetch_task.done():
            logger.warning("Background fetch loop already running")
            return
        self._fetch_task = asyncio.create_task(self._fetch_loop())
        logger.info("Background news fetch loop started (interval={}s)", self._fetch_interval_seconds)

    async def stop_background_fetching(self) -> None:
        """Stop the periodic background fetch loop."""
        if self._fetch_task:
            self._fetch_task.cancel()
            try:
                await self._fetch_task
            except asyncio.CancelledError:
                pass
            self._fetch_task = None
            logger.info("Background news fetch loop stopped")

    async def shutdown(self) -> None:
        """Graceful shutdown."""
        await self.stop_background_fetching()
        await self._save_state()
        self._initialized = False
        logger.info("NewsTrainingService shut down")

    # ------------------------------------------------------------------
    # Event handler
    # ------------------------------------------------------------------

    async def _handle_event(self, event: Event) -> None:
        """Handle incoming events."""
        try:
            if event.event_type == "news.fetch_now":
                await self.fetch_all_sources()
            elif event.event_type == "news.add_source":
                await self.add_source(
                    name=event.data.get("name", ""),
                    url=event.data.get("url", ""),
                    category=event.data.get("category", "general"),
                )
            elif event.event_type == "news.generate_digest":
                period = event.data.get("period", "daily")
                await self.generate_digest(period=period)
        except Exception as exc:
            logger.error("Error handling event {}: {}", event.event_type, exc)

    # ------------------------------------------------------------------
    # Background fetch loop
    # ------------------------------------------------------------------

    async def _fetch_loop(self) -> None:
        """Periodically fetch news from all active sources."""
        while True:
            try:
                await self.fetch_all_sources()
            except Exception as exc:
                logger.error("Fetch loop error: {}", exc)
            await asyncio.sleep(self._fetch_interval_seconds)

    # ------------------------------------------------------------------
    # Source management
    # ------------------------------------------------------------------

    async def add_source(self, name: str, url: str,
                         category: str = "general",
                         reliability: float = 0.7) -> NewsSource:
        """Add a new news source."""
        sid = hashlib.md5(url.encode()).hexdigest()[:12]
        if sid in self._sources:
            logger.warning("Source already exists: {} ({})", name, url)
            return self._sources[sid]

        source = NewsSource(
            source_id=sid,
            name=name,
            url=url,
            category=NewsCategory(category),
            reliability_score=reliability,
        )
        self._sources[sid] = source
        await self._save_state()
        logger.info("Added news source: {} [{}]", name, category)
        return source

    async def remove_source(self, source_id: str) -> bool:
        """Remove a news source by ID."""
        if source_id in self._sources:
            name = self._sources[source_id].name
            del self._sources[source_id]
            await self._save_state()
            logger.info("Removed news source: {}", name)
            return True
        return False

    async def enable_source(self, source_id: str) -> bool:
        """Enable a disabled news source."""
        if source_id in self._sources:
            self._sources[source_id].status = SourceStatus.ACTIVE
            self._sources[source_id].consecutive_errors = 0
            logger.info("Enabled source: {}", self._sources[source_id].name)
            return True
        return False

    async def disable_source(self, source_id: str) -> bool:
        """Disable a news source."""
        if source_id in self._sources:
            self._sources[source_id].status = SourceStatus.DISABLED
            logger.info("Disabled source: {}", self._sources[source_id].name)
            return True
        return False

    def list_sources(self) -> List[Dict[str, Any]]:
        """List all configured news sources."""
        return [s.to_dict() for s in self._sources.values()]

    async def update_source_reliability(self, source_id: str, score: float) -> None:
        """Update reliability score for a source (0.0 – 1.0)."""
        if source_id in self._sources:
            self._sources[source_id].reliability_score = max(0.0, min(1.0, score))

    # ------------------------------------------------------------------
    # Fetching
    # ------------------------------------------------------------------

    async def fetch_all_sources(self) -> int:
        """Fetch news from all active sources. Returns count of new articles."""
        total_new = 0
        for source in list(self._sources.values()):
            if source.status != SourceStatus.ACTIVE:
                continue
            try:
                count = await self._fetch_source(source)
                total_new += count
            except Exception as exc:
                source.consecutive_errors += 1
                source.last_error = str(exc)
                if source.consecutive_errors >= 5:
                    source.status = SourceStatus.ERROR
                    logger.warning("Source {} marked as ERROR after {} consecutive failures",
                                   source.name, source.consecutive_errors)
                self._total_fetch_errors += 1
                logger.error("Error fetching {}: {}", source.name, exc)

        self._last_fetch_time = datetime.utcnow()

        if total_new > 0:
            await self._process_new_articles()
            await self._update_trends()
            await self._generate_training_prompts()
            await self._save_state()

            await event_bus.publish(Event(
                event_type="news.fetch_complete",
                data={"new_articles": total_new, "total_articles": len(self._articles)},
                category=EventCategory.TRAINING,
                priority=EventPriority.NORMAL,
                source="news_training_service",
            ))

        logger.info("Fetch cycle complete – {} new articles, {} total",
                     total_new, len(self._articles))
        return total_new

    async def _fetch_source(self, source: NewsSource) -> int:
        """Fetch articles from a single RSS source."""
        import xml.etree.ElementTree as ET

        try:
            # Use aiohttp if available, fall back to urllib
            feed_text = await self._http_get(source.url)
        except Exception as exc:
            raise RuntimeError(f"HTTP fetch failed for {source.url}: {exc}")

        new_count = 0
        try:
            root = ET.fromstring(feed_text)
        except ET.ParseError as exc:
            raise RuntimeError(f"XML parse error for {source.name}: {exc}")

        # Support both RSS 2.0 (<item>) and Atom (<entry>)
        items = root.findall(".//item") or root.findall(
            ".//{http://www.w3.org/2005/Atom}entry"
        )

        for item in items:
            title = self._xml_text(item, "title") or self._xml_text(
                item, "{http://www.w3.org/2005/Atom}title"
            ) or ""
            link = self._xml_text(item, "link") or ""
            if not link:
                link_el = item.find("{http://www.w3.org/2005/Atom}link")
                if link_el is not None:
                    link = link_el.get("href", "")

            description = (
                self._xml_text(item, "description")
                or self._xml_text(item, "{http://www.w3.org/2005/Atom}summary")
                or ""
            )
            pub_date_str = (
                self._xml_text(item, "pubDate")
                or self._xml_text(item, "{http://www.w3.org/2005/Atom}updated")
            )
            author = (
                self._xml_text(item, "author")
                or self._xml_text(item, "{http://www.w3.org/2005/Atom}author/{http://www.w3.org/2005/Atom}name")
                or ""
            )

            # Content deduplication
            content_for_hash = (title + description).strip()
            content_hash = hashlib.sha256(content_for_hash.encode()).hexdigest()[:16]
            if content_hash in self._content_hashes:
                continue
            self._content_hashes.add(content_hash)

            # Clean HTML from description
            clean_content = self._strip_html(description)

            # Parse publication date
            published_at = self._parse_date(pub_date_str) if pub_date_str else None

            article = NewsArticle(
                source_id=source.source_id,
                title=title.strip(),
                url=link.strip(),
                author=author.strip(),
                published_at=published_at,
                content=clean_content,
                content_hash=content_hash,
                word_count=len(clean_content.split()),
            )
            self._articles[article.article_id] = article
            new_count += 1

        source.last_fetched = datetime.utcnow()
        source.articles_fetched += new_count
        source.consecutive_errors = 0
        return new_count

    # ------------------------------------------------------------------
    # Content processing
    # ------------------------------------------------------------------

    async def _process_new_articles(self) -> None:
        """Process all FETCHED articles: summarise, classify, extract keywords."""
        for article in self._articles.values():
            if article.status != ArticleStatus.FETCHED:
                continue
            try:
                # Keyword extraction
                article.keywords = self._extract_keywords(article.content, top_n=10)

                # Category classification
                article.category = self._classify_category(article.title + " " + article.content)

                # Simple extractive summary (first 2–3 sentences)
                article.summary = self._extractive_summary(article.content, max_sentences=3)

                # Basic sentiment (positive-word vs negative-word ratio)
                article.sentiment_score = self._basic_sentiment(article.content)

                # Relevance score based on user interests
                article.relevance_score = self._compute_relevance(article)

                article.status = ArticleStatus.PROCESSED
                self._total_articles_processed += 1
            except Exception as exc:
                article.status = ArticleStatus.FAILED
                logger.error("Error processing article {}: {}", article.article_id[:8], exc)

    def _extract_keywords(self, text: str, top_n: int = 10) -> List[str]:
        """Extract top keywords by frequency (after removing stop words)."""
        words = re.findall(r"[a-zA-Z]{3,}", text.lower())
        filtered = [w for w in words if w not in STOP_WORDS]
        counts = Counter(filtered)
        return [word for word, _ in counts.most_common(top_n)]

    def _classify_category(self, text: str) -> NewsCategory:
        """Classify article category by keyword matching."""
        text_lower = text.lower()
        scores: Dict[str, int] = {}
        for cat, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            scores[cat] = score
        if not scores or max(scores.values()) == 0:
            return NewsCategory.GENERAL
        best = max(scores, key=scores.get)  # type: ignore[arg-type]
        return NewsCategory(best)

    def _extractive_summary(self, text: str, max_sentences: int = 3) -> str:
        """Return the first N sentences as a summary."""
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        return " ".join(sentences[:max_sentences])

    def _basic_sentiment(self, text: str) -> float:
        """Very simple positive/negative keyword sentiment in [-1, 1]."""
        positive = {"good", "great", "excellent", "positive", "growth", "success",
                    "win", "improve", "breakthrough", "innovative", "progress",
                    "benefit", "profit", "gain", "rise", "strong", "best"}
        negative = {"bad", "worst", "fail", "crisis", "loss", "decline", "crash",
                    "negative", "threat", "risk", "danger", "conflict", "death",
                    "attack", "collapse", "recession", "war", "fraud"}
        words = set(re.findall(r"[a-z]+", text.lower()))
        pos = len(words & positive)
        neg = len(words & negative)
        total = pos + neg
        if total == 0:
            return 0.0
        return round((pos - neg) / total, 3)

    def _compute_relevance(self, article: NewsArticle) -> float:
        """Compute relevance score based on user interests."""
        if not self._user_interests:
            return 0.5
        combined = (article.title + " " + article.content).lower()
        matches = sum(1 for interest in self._user_interests if interest.lower() in combined)
        return min(1.0, matches / max(len(self._user_interests), 1))

    # ------------------------------------------------------------------
    # Trend analysis
    # ------------------------------------------------------------------

    async def _update_trends(self) -> None:
        """Update keyword trends from recently processed articles."""
        cutoff = datetime.utcnow() - timedelta(hours=24)
        recent_articles = [
            a for a in self._articles.values()
            if a.status == ArticleStatus.PROCESSED and a.fetched_at >= cutoff
        ]

        for article in recent_articles:
            for keyword in article.keywords:
                self._keyword_counts[keyword] += 1
                if keyword in self._trends:
                    entry = self._trends[keyword]
                    entry.last_seen = datetime.utcnow()
                    entry.occurrences += 1
                    if article.article_id not in entry.associated_articles:
                        entry.associated_articles.append(article.article_id)
                else:
                    self._trends[keyword] = TrendEntry(
                        keyword=keyword,
                        associated_articles=[article.article_id],
                    )

        # Calculate velocity (occurrences per hour)
        for entry in self._trends.values():
            span_hours = max(
                1.0,
                (entry.last_seen - entry.first_seen).total_seconds() / 3600.0,
            )
            entry.velocity = entry.occurrences / span_hours

    def get_trending_topics(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Return the top trending topics sorted by velocity."""
        sorted_trends = sorted(
            self._trends.values(),
            key=lambda t: t.velocity,
            reverse=True,
        )[:limit]

        return [
            {
                "keyword": t.keyword,
                "occurrences": t.occurrences,
                "velocity": round(t.velocity, 2),
                "first_seen": t.first_seen.isoformat(),
                "last_seen": t.last_seen.isoformat(),
                "article_count": len(t.associated_articles),
            }
            for t in sorted_trends
        ]

    def get_emerging_topics(self, min_velocity: float = 2.0) -> List[Dict[str, Any]]:
        """Return topics with rapidly increasing velocity (emerging)."""
        emerging = [
            t for t in self._trends.values()
            if t.velocity >= min_velocity
            and (datetime.utcnow() - t.first_seen) < timedelta(hours=12)
        ]
        emerging.sort(key=lambda t: t.velocity, reverse=True)
        return [
            {"keyword": t.keyword, "velocity": round(t.velocity, 2),
             "occurrences": t.occurrences}
            for t in emerging
        ]

    # ------------------------------------------------------------------
    # Self-training pipeline
    # ------------------------------------------------------------------

    async def _generate_training_prompts(self) -> None:
        """Generate fine-tuning style prompts from newly processed articles."""
        new_articles = [
            a for a in self._articles.values()
            if a.status == ArticleStatus.PROCESSED
        ]

        training_data: List[Dict[str, str]] = []
        for article in new_articles[:50]:  # batch of 50
            # Prompt: ask about the topic → answer with summary
            if article.summary and article.title:
                prompt = f"What is the latest news about {article.keywords[0] if article.keywords else article.category.value}?"
                response = (
                    f"Based on recent reports, {article.summary} "
                    f"(Source: {article.source_id}, {article.fetched_at.strftime('%Y-%m-%d')})"
                )
                training_data.append({"instruction": prompt, "output": response})

            # Prompt: summarise
            if article.content and len(article.content) > 100:
                training_data.append({
                    "instruction": f"Summarise this article: {article.title}",
                    "output": article.summary,
                })

            article.status = ArticleStatus.TRAINED

        if training_data:
            # Persist training prompts
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            path = self._data_dir / f"training_prompts_{ts}.json"
            try:
                path.write_text(json.dumps(training_data, indent=2), encoding="utf-8")
                logger.info("Generated {} training prompts → {}", len(training_data), path.name)
            except Exception as exc:
                logger.error("Failed to save training prompts: {}", exc)

            await event_bus.publish(Event(
                event_type="news.training_prompts_generated",
                data={"count": len(training_data), "path": str(path)},
                category=EventCategory.TRAINING,
                priority=EventPriority.LOW,
                source="news_training_service",
            ))

    # ------------------------------------------------------------------
    # Digest generation
    # ------------------------------------------------------------------

    async def generate_digest(self, period: str = "daily",
                              interests: Optional[List[str]] = None) -> NewsDigest:
        """Generate a news digest for the given period."""
        if period == "daily":
            cutoff = datetime.utcnow() - timedelta(days=1)
        elif period == "weekly":
            cutoff = datetime.utcnow() - timedelta(weeks=1)
        else:
            cutoff = datetime.utcnow() - timedelta(days=1)

        relevant = [
            a for a in self._articles.values()
            if a.fetched_at >= cutoff and a.status in (ArticleStatus.PROCESSED, ArticleStatus.TRAINED)
        ]

        # Sort by relevance if user interests provided
        if interests:
            for a in relevant:
                combined = (a.title + " " + a.content).lower()
                a.relevance_score = sum(1 for i in interests if i.lower() in combined) / max(len(interests), 1)
            relevant.sort(key=lambda a: a.relevance_score, reverse=True)

        # Group by category
        categories: Dict[str, List[Dict[str, str]]] = defaultdict(list)
        for article in relevant:
            categories[article.category.value].append({
                "title": article.title,
                "summary": article.summary,
                "url": article.url,
                "published": article.published_at.isoformat() if article.published_at else "",
            })

        # Top stories (highest relevance or most recent)
        top_stories = [
            {"title": a.title, "summary": a.summary, "url": a.url, "category": a.category.value}
            for a in relevant[:10]
        ]

        # Trending topics
        trending = [t.keyword for t in sorted(
            self._trends.values(), key=lambda t: t.velocity, reverse=True
        )[:10]]

        digest = NewsDigest(
            period=period,
            categories=dict(categories),
            top_stories=top_stories,
            trending_topics=trending,
            total_articles=len(relevant),
        )

        # Persist digest
        try:
            digest_path = self._digests_dir / f"digest_{digest.digest_id[:8]}_{period}.json"
            digest_path.write_text(json.dumps(digest.to_dict(), indent=2), encoding="utf-8")
            logger.info("Generated {} digest with {} articles", period, len(relevant))
        except Exception as exc:
            logger.error("Failed to save digest: {}", exc)

        await event_bus.publish(Event(
            event_type="news.digest_generated",
            data=digest.to_dict(),
            category=EventCategory.NOTIFICATION,
            priority=EventPriority.NORMAL,
            source="news_training_service",
        ))

        return digest

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search_articles(self, query: str, limit: int = 20,
                        category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Full-text search across stored articles."""
        query_lower = query.lower()
        query_words = set(query_lower.split())

        results: List[Tuple[float, NewsArticle]] = []
        for article in self._articles.values():
            if category and article.category.value != category:
                continue

            text = (article.title + " " + article.content + " " + " ".join(article.keywords)).lower()
            # Score: count of query word occurrences
            score = sum(text.count(w) for w in query_words)
            if score > 0:
                results.append((score, article))

        results.sort(key=lambda x: x[0], reverse=True)
        return [a.to_dict() for _, a in results[:limit]]

    def semantic_search_articles(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Semantic search interface (placeholder – integrate with embedding model)."""
        # For now, falls back to keyword search with boosted title matches
        query_lower = query.lower()
        results: List[Tuple[float, NewsArticle]] = []
        for article in self._articles.values():
            title_score = 2.0 if query_lower in article.title.lower() else 0.0
            keyword_score = sum(1.0 for k in article.keywords if k in query_lower)
            content_score = article.content.lower().count(query_lower) * 0.5
            total = title_score + keyword_score + content_score
            if total > 0:
                results.append((total, article))

        results.sort(key=lambda x: x[0], reverse=True)
        return [a.to_dict() for _, a in results[:limit]]

    # ------------------------------------------------------------------
    # User interests
    # ------------------------------------------------------------------

    def set_user_interests(self, interests: List[str]) -> None:
        """Set user interest topics for relevance scoring."""
        self._user_interests = [i.strip().lower() for i in interests if i.strip()]
        logger.info("User interests updated: {}", self._user_interests)

    def get_user_interests(self) -> List[str]:
        return list(self._user_interests)

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def get_statistics(self) -> Dict[str, Any]:
        """Return service statistics."""
        active_sources = sum(1 for s in self._sources.values() if s.status == SourceStatus.ACTIVE)
        category_counts: Dict[str, int] = Counter(
            a.category.value for a in self._articles.values()
        )
        storage_bytes = sum(len(a.content.encode()) for a in self._articles.values())

        return {
            "total_sources": len(self._sources),
            "active_sources": active_sources,
            "total_articles": len(self._articles),
            "articles_processed": self._total_articles_processed,
            "total_fetch_errors": self._total_fetch_errors,
            "unique_content_hashes": len(self._content_hashes),
            "trending_topics_count": len(self._trends),
            "category_distribution": dict(category_counts),
            "storage_bytes": storage_bytes,
            "storage_mb": round(storage_bytes / (1024 * 1024), 2),
            "last_fetch_time": self._last_fetch_time.isoformat() if self._last_fetch_time else None,
            "fetch_interval_seconds": self._fetch_interval_seconds,
            "user_interests": self._user_interests,
            "background_fetching": self._fetch_task is not None and not self._fetch_task.done(),
        }

    def set_fetch_interval(self, seconds: int) -> None:
        """Update the background fetch interval (minimum 300 s)."""
        self._fetch_interval_seconds = max(300, seconds)
        logger.info("Fetch interval set to {} seconds", self._fetch_interval_seconds)

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    async def _save_state(self) -> None:
        """Persist sources and article index to disk."""
        try:
            state = {
                "sources": {sid: s.to_dict() for sid, s in self._sources.items()},
                "content_hashes": list(self._content_hashes),
                "keyword_counts": dict(self._keyword_counts.most_common(500)),
                "user_interests": self._user_interests,
                "total_articles_processed": self._total_articles_processed,
                "total_fetch_errors": self._total_fetch_errors,
            }
            state_path = self._data_dir / "news_state.json"
            state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")

            # Save articles index (last 1000)
            recent = sorted(
                self._articles.values(),
                key=lambda a: a.fetched_at,
                reverse=True,
            )[:1000]
            index = [a.to_dict() for a in recent]
            index_path = self._data_dir / "articles_index.json"
            index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.error("Failed to save news state: {}", exc)

    async def _load_state(self) -> None:
        """Restore persisted state from disk."""
        state_path = self._data_dir / "news_state.json"
        if not state_path.exists():
            return

        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
            self._content_hashes = set(state.get("content_hashes", []))
            self._user_interests = state.get("user_interests", [])
            self._total_articles_processed = state.get("total_articles_processed", 0)
            self._total_fetch_errors = state.get("total_fetch_errors", 0)
            kw = state.get("keyword_counts", {})
            self._keyword_counts = Counter(kw)

            # Restore sources (merge with defaults)
            for sid, sdata in state.get("sources", {}).items():
                if sid not in self._sources:
                    self._sources[sid] = NewsSource(
                        source_id=sdata["source_id"],
                        name=sdata["name"],
                        url=sdata["url"],
                        category=NewsCategory(sdata.get("category", "general")),
                        status=SourceStatus(sdata.get("status", "active")),
                        reliability_score=sdata.get("reliability_score", 0.8),
                        articles_fetched=sdata.get("articles_fetched", 0),
                    )
            logger.info("Restored news state – {} hashes, {} keywords",
                        len(self._content_hashes), len(self._keyword_counts))
        except Exception as exc:
            logger.error("Failed to load news state: {}", exc)

    # ------------------------------------------------------------------
    # HTTP helper
    # ------------------------------------------------------------------

    @staticmethod
    async def _http_get(url: str, timeout: int = 30) -> str:
        """Async HTTP GET returning response text."""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                    resp.raise_for_status()
                    return await resp.text()
        except ImportError:
            # Fallback to synchronous urllib in a thread
            import urllib.request
            loop = asyncio.get_running_loop()
            req = urllib.request.Request(url, headers={"User-Agent": "NexusAI/1.0"})

            def _fetch():
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    return response.read().decode("utf-8", errors="replace")

            return await loop.run_in_executor(None, _fetch)

    # ------------------------------------------------------------------
    # XML / text helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _xml_text(element, tag: str) -> Optional[str]:
        """Safely extract text from an XML element."""
        child = element.find(tag)
        return child.text.strip() if child is not None and child.text else None

    @staticmethod
    def _strip_html(text: str) -> str:
        """Remove HTML tags from text."""
        clean = re.sub(r"<[^>]+>", " ", text)
        clean = re.sub(r"\s+", " ", clean)
        return clean.strip()

    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime]:
        """Best-effort date parsing for RSS date formats."""
        formats = [
            "%a, %d %b %Y %H:%M:%S %z",
            "%a, %d %b %Y %H:%M:%S %Z",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        return None


# =====================================================================
# Module-level singleton
# =====================================================================

news_training_service = NewsTrainingService()
