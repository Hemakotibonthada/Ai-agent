"""
Advanced Caching Service
Features: Multi-tier caching (memory + disk), TTL, LRU eviction, cache warming,
          pattern invalidation, cache statistics, serialization, compression
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import pickle
import time
import zlib
from collections import OrderedDict
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, TypeVar, Generic

T = TypeVar("T")


class CacheStrategy(str, Enum):
    LRU = "lru"
    LFU = "lfu"
    FIFO = "fifo"
    TTL = "ttl"


class CacheTier(str, Enum):
    MEMORY = "memory"
    DISK = "disk"
    BOTH = "both"


@dataclass
class CacheEntry:
    key: str
    value: Any
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    ttl: Optional[float] = None
    access_count: int = 0
    size_bytes: int = 0
    tags: Set[str] = field(default_factory=set)
    compressed: bool = False

    @property
    def is_expired(self) -> bool:
        if self.ttl is None:
            return False
        return time.time() - self.created_at > self.ttl

    def touch(self):
        self.last_accessed = time.time()
        self.access_count += 1


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    sets: int = 0
    deletes: int = 0
    total_entries: int = 0
    memory_entries: int = 0
    disk_entries: int = 0
    total_size_bytes: int = 0
    avg_access_time_ms: float = 0
    uptime_seconds: float = 0
    hit_rate: float = 0
    started_at: float = field(default_factory=time.time)

    def record_hit(self):
        self.hits += 1
        self._update_rate()

    def record_miss(self):
        self.misses += 1
        self._update_rate()

    def _update_rate(self):
        total = self.hits + self.misses
        self.hit_rate = self.hits / total if total > 0 else 0
        self.uptime_seconds = time.time() - self.started_at


class MemoryCache:
    """In-memory LRU cache with TTL support."""

    def __init__(self, max_size: int = 10000, max_memory_mb: float = 256):
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._max_memory_bytes = int(max_memory_mb * 1024 * 1024)
        self._current_size_bytes = 0
        self._lock = asyncio.Lock()
        self._tag_index: Dict[str, Set[str]] = {}

    async def get(self, key: str) -> Optional[CacheEntry]:
        async with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if entry.is_expired:
                self._remove_entry(key)
                return None
            entry.touch()
            self._cache.move_to_end(key)
            return entry

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None,
        tags: Optional[Set[str]] = None,
        compress: bool = False,
    ) -> CacheEntry:
        async with self._lock:
            if key in self._cache:
                self._remove_entry(key)

            serialized = pickle.dumps(value)
            size = len(serialized)

            if compress and size > 1024:
                serialized = zlib.compress(serialized)
                size = len(serialized)

            while (
                len(self._cache) >= self._max_size
                or self._current_size_bytes + size > self._max_memory_bytes
            ) and self._cache:
                self._evict_one()

            entry = CacheEntry(
                key=key,
                value=value,
                ttl=ttl,
                size_bytes=size,
                tags=tags or set(),
                compressed=compress,
            )
            self._cache[key] = entry
            self._current_size_bytes += size

            for tag in entry.tags:
                if tag not in self._tag_index:
                    self._tag_index[tag] = set()
                self._tag_index[tag].add(key)

            return entry

    async def delete(self, key: str) -> bool:
        async with self._lock:
            if key in self._cache:
                self._remove_entry(key)
                return True
            return False

    async def invalidate_by_tag(self, tag: str) -> int:
        async with self._lock:
            keys = self._tag_index.get(tag, set()).copy()
            for key in keys:
                self._remove_entry(key)
            return len(keys)

    async def invalidate_by_pattern(self, pattern: str) -> int:
        import re
        async with self._lock:
            regex = re.compile(pattern)
            keys_to_remove = [k for k in self._cache if regex.match(k)]
            for key in keys_to_remove:
                self._remove_entry(key)
            return len(keys_to_remove)

    async def clear(self):
        async with self._lock:
            self._cache.clear()
            self._tag_index.clear()
            self._current_size_bytes = 0

    async def keys(self, pattern: Optional[str] = None) -> List[str]:
        import re
        async with self._lock:
            if pattern:
                regex = re.compile(pattern)
                return [k for k in self._cache if regex.match(k)]
            return list(self._cache.keys())

    async def size(self) -> int:
        return len(self._cache)

    async def memory_usage(self) -> int:
        return self._current_size_bytes

    def _remove_entry(self, key: str):
        entry = self._cache.pop(key, None)
        if entry:
            self._current_size_bytes -= entry.size_bytes
            for tag in entry.tags:
                if tag in self._tag_index:
                    self._tag_index[tag].discard(key)

    def _evict_one(self):
        if self._cache:
            key, _ = self._cache.popitem(last=False)
            self._remove_entry(key)


class DiskCache:
    """Persistent disk-based cache."""

    def __init__(self, cache_dir: str = "data/cache", max_size_mb: float = 1024):
        self._cache_dir = Path(cache_dir)
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._meta_dir = self._cache_dir / ".meta"
        self._meta_dir.mkdir(exist_ok=True)
        self._max_size_bytes = int(max_size_mb * 1024 * 1024)
        self._lock = asyncio.Lock()

    def _key_to_path(self, key: str) -> Path:
        hashed = hashlib.sha256(key.encode()).hexdigest()
        return self._cache_dir / hashed[:2] / hashed[2:4] / hashed

    def _meta_path(self, key: str) -> Path:
        hashed = hashlib.sha256(key.encode()).hexdigest()
        return self._meta_dir / f"{hashed}.json"

    async def get(self, key: str) -> Optional[CacheEntry]:
        async with self._lock:
            path = self._key_to_path(key)
            meta_path = self._meta_path(key)

            if not path.exists() or not meta_path.exists():
                return None

            try:
                meta = json.loads(meta_path.read_text())
                if meta.get("ttl") and time.time() - meta["created_at"] > meta["ttl"]:
                    self._remove_files(path, meta_path)
                    return None

                data = path.read_bytes()
                if meta.get("compressed"):
                    data = zlib.decompress(data)
                value = pickle.loads(data)

                meta["last_accessed"] = time.time()
                meta["access_count"] = meta.get("access_count", 0) + 1
                meta_path.write_text(json.dumps(meta))

                return CacheEntry(
                    key=key,
                    value=value,
                    created_at=meta["created_at"],
                    last_accessed=meta["last_accessed"],
                    ttl=meta.get("ttl"),
                    access_count=meta["access_count"],
                    size_bytes=len(data),
                    tags=set(meta.get("tags", [])),
                    compressed=meta.get("compressed", False),
                )
            except Exception:
                self._remove_files(path, meta_path)
                return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None,
        tags: Optional[Set[str]] = None,
        compress: bool = False,
    ) -> CacheEntry:
        async with self._lock:
            path = self._key_to_path(key)
            meta_path = self._meta_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)

            data = pickle.dumps(value)
            compressed = False
            if compress and len(data) > 1024:
                data = zlib.compress(data)
                compressed = True

            path.write_bytes(data)

            meta = {
                "key": key,
                "created_at": time.time(),
                "last_accessed": time.time(),
                "ttl": ttl,
                "access_count": 0,
                "size_bytes": len(data),
                "tags": list(tags or []),
                "compressed": compressed,
            }
            meta_path.write_text(json.dumps(meta))

            return CacheEntry(
                key=key,
                value=value,
                created_at=meta["created_at"],
                ttl=ttl,
                size_bytes=len(data),
                tags=tags or set(),
                compressed=compressed,
            )

    async def delete(self, key: str) -> bool:
        async with self._lock:
            path = self._key_to_path(key)
            meta_path = self._meta_path(key)
            if path.exists():
                self._remove_files(path, meta_path)
                return True
            return False

    async def clear(self):
        import shutil
        async with self._lock:
            for item in self._cache_dir.iterdir():
                if item.is_dir() and item != self._meta_dir:
                    shutil.rmtree(item, ignore_errors=True)
            for item in self._meta_dir.iterdir():
                item.unlink(missing_ok=True)

    def _remove_files(self, path: Path, meta_path: Path):
        path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)


class CacheService:
    """
    Multi-tier caching service with memory + disk tiers.

    Features:
    - In-memory LRU cache (fast, limited size)
    - Disk cache (persistent, larger capacity)
    - TTL-based expiration
    - Tag-based invalidation
    - Pattern-based key invalidation
    - Cache warming / preloading
    - Compression for large values
    - Cache statistics and monitoring
    - Decorator for function result caching
    """

    def __init__(
        self,
        memory_max_size: int = 10000,
        memory_max_mb: float = 256,
        disk_cache_dir: str = "data/cache",
        disk_max_mb: float = 1024,
        default_ttl: Optional[float] = 3600,
        default_tier: CacheTier = CacheTier.MEMORY,
    ):
        self.memory = MemoryCache(memory_max_size, memory_max_mb)
        self.disk = DiskCache(disk_cache_dir, disk_max_mb)
        self.default_ttl = default_ttl
        self.default_tier = default_tier
        self.stats = CacheStats()
        self._warming_tasks: Dict[str, asyncio.Task] = {}
        self._namespaces: Dict[str, Dict[str, Any]] = {}

    async def get(
        self,
        key: str,
        tier: Optional[CacheTier] = None,
        namespace: Optional[str] = None,
    ) -> Optional[Any]:
        """Get a value from the cache."""
        full_key = self._full_key(key, namespace)
        target_tier = tier or self.default_tier

        # Check memory first
        if target_tier in (CacheTier.MEMORY, CacheTier.BOTH):
            entry = await self.memory.get(full_key)
            if entry:
                self.stats.record_hit()
                return entry.value

        # Fall back to disk
        if target_tier in (CacheTier.DISK, CacheTier.BOTH):
            entry = await self.disk.get(full_key)
            if entry:
                self.stats.record_hit()
                # Promote to memory cache
                if target_tier == CacheTier.BOTH:
                    await self.memory.set(
                        full_key, entry.value, entry.ttl, entry.tags
                    )
                return entry.value

        self.stats.record_miss()
        return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None,
        tier: Optional[CacheTier] = None,
        tags: Optional[Set[str]] = None,
        compress: bool = False,
        namespace: Optional[str] = None,
    ) -> None:
        """Set a value in the cache."""
        full_key = self._full_key(key, namespace)
        target_tier = tier or self.default_tier
        effective_ttl = ttl if ttl is not None else self.default_ttl

        if target_tier in (CacheTier.MEMORY, CacheTier.BOTH):
            await self.memory.set(full_key, value, effective_ttl, tags, compress)

        if target_tier in (CacheTier.DISK, CacheTier.BOTH):
            await self.disk.set(full_key, value, effective_ttl, tags, compress)

        self.stats.sets += 1
        self.stats.total_entries = await self.memory.size()

    async def delete(
        self,
        key: str,
        tier: Optional[CacheTier] = None,
        namespace: Optional[str] = None,
    ) -> bool:
        """Delete a key from the cache."""
        full_key = self._full_key(key, namespace)
        target_tier = tier or CacheTier.BOTH
        deleted = False

        if target_tier in (CacheTier.MEMORY, CacheTier.BOTH):
            deleted |= await self.memory.delete(full_key)

        if target_tier in (CacheTier.DISK, CacheTier.BOTH):
            deleted |= await self.disk.delete(full_key)

        if deleted:
            self.stats.deletes += 1
        return deleted

    async def get_or_set(
        self,
        key: str,
        factory: Callable,
        ttl: Optional[float] = None,
        tier: Optional[CacheTier] = None,
        tags: Optional[Set[str]] = None,
        namespace: Optional[str] = None,
    ) -> Any:
        """Get from cache or compute and store."""
        value = await self.get(key, tier, namespace)
        if value is not None:
            return value

        if asyncio.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = factory()

        await self.set(key, value, ttl, tier, tags, namespace=namespace)
        return value

    async def invalidate_by_tag(self, tag: str) -> int:
        """Invalidate all cache entries with a specific tag."""
        count = await self.memory.invalidate_by_tag(tag)
        self.stats.evictions += count
        return count

    async def invalidate_by_pattern(self, pattern: str) -> int:
        """Invalidate cache entries matching a key pattern."""
        count = await self.memory.invalidate_by_pattern(pattern)
        self.stats.evictions += count
        return count

    async def clear(self, tier: Optional[CacheTier] = None):
        """Clear all cache entries."""
        target = tier or CacheTier.BOTH
        if target in (CacheTier.MEMORY, CacheTier.BOTH):
            await self.memory.clear()
        if target in (CacheTier.DISK, CacheTier.BOTH):
            await self.disk.clear()

    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        self.stats.memory_entries = await self.memory.size()
        self.stats.total_size_bytes = await self.memory.memory_usage()
        self.stats.uptime_seconds = time.time() - self.stats.started_at
        return {
            "hits": self.stats.hits,
            "misses": self.stats.misses,
            "hit_rate": round(self.stats.hit_rate * 100, 2),
            "evictions": self.stats.evictions,
            "sets": self.stats.sets,
            "deletes": self.stats.deletes,
            "memory_entries": self.stats.memory_entries,
            "disk_entries": self.stats.disk_entries,
            "total_size_bytes": self.stats.total_size_bytes,
            "total_size_mb": round(self.stats.total_size_bytes / 1024 / 1024, 2),
            "uptime_seconds": round(self.stats.uptime_seconds, 1),
        }

    async def warm_cache(
        self,
        entries: Dict[str, Any],
        ttl: Optional[float] = None,
        tags: Optional[Set[str]] = None,
    ) -> int:
        """Pre-populate cache with data."""
        count = 0
        for key, value in entries.items():
            await self.set(key, value, ttl, tags=tags)
            count += 1
        return count

    async def get_keys(
        self, pattern: Optional[str] = None, namespace: Optional[str] = None
    ) -> List[str]:
        """List cache keys."""
        prefix = f"{namespace}:" if namespace else None
        keys = await self.memory.keys(pattern)
        if prefix:
            keys = [k for k in keys if k.startswith(prefix)]
        return keys

    def cached(
        self,
        ttl: Optional[float] = None,
        tier: Optional[CacheTier] = None,
        tags: Optional[Set[str]] = None,
        key_prefix: Optional[str] = None,
    ):
        """Decorator for caching function results."""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                parts = [key_prefix or func.__name__]
                parts.extend(str(a) for a in args)
                parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
                cache_key = ":".join(parts)

                result = await self.get(cache_key, tier)
                if result is not None:
                    return result

                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)

                await self.set(cache_key, result, ttl, tier, tags)
                return result
            return wrapper
        return decorator

    def _full_key(self, key: str, namespace: Optional[str] = None) -> str:
        if namespace:
            return f"{namespace}:{key}"
        return key


# ── Singleton ─────────────────────────────────────────────────────────
_cache_service: Optional[CacheService] = None

def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service
