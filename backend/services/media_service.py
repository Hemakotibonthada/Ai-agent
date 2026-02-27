"""
Media Management Service - Digital asset management with metadata extraction,
tagging, organization, thumbnail generation, and search.
"""

import hashlib
import mimetypes
import os
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict


class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    OTHER = "other"


class MediaStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    PROCESSING = "processing"
    ERROR = "error"
    DELETED = "deleted"


@dataclass
class MediaMetadata:
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    bitrate: Optional[int] = None
    codec: Optional[str] = None
    color_space: Optional[str] = None
    has_alpha: bool = False
    frame_rate: Optional[float] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    orientation: Optional[int] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    custom: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MediaItem:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    original_name: str = ""
    type: MediaType = MediaType.OTHER
    mime_type: str = "application/octet-stream"
    extension: str = ""
    size_bytes: int = 0
    file_path: str = ""
    thumbnail_path: Optional[str] = None
    url: str = ""
    thumbnail_url: Optional[str] = None
    folder: str = "Uncategorized"
    tags: List[str] = field(default_factory=list)
    description: str = ""
    alt_text: str = ""
    starred: bool = False
    status: MediaStatus = MediaStatus.ACTIVE
    metadata: MediaMetadata = field(default_factory=MediaMetadata)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    uploaded_by: str = "system"
    checksum: str = ""
    views: int = 0
    downloads: int = 0
    version: int = 1
    variants: Dict[str, str] = field(default_factory=dict)

    @property
    def size_human(self) -> str:
        """Human-readable file size."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if self.size_bytes < 1024:
                return f"{self.size_bytes:.1f} {unit}"
            self.size_bytes /= 1024
        return f"{self.size_bytes:.1f} PB"

    @property
    def dimensions(self) -> Optional[str]:
        if self.metadata.width and self.metadata.height:
            return f"{self.metadata.width}x{self.metadata.height}"
        return None

    @property
    def duration_human(self) -> Optional[str]:
        if self.metadata.duration_seconds is None:
            return None
        total = int(self.metadata.duration_seconds)
        hours, remainder = divmod(total, 3600)
        minutes, seconds = divmod(remainder, 60)
        if hours > 0:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"


@dataclass
class MediaFolder:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    parent_id: Optional[str] = None
    path: str = ""
    item_count: int = 0
    total_size_bytes: int = 0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    color: str = "#8B5CF6"
    icon: str = "folder"


@dataclass
class MediaCollection:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    item_ids: List[str] = field(default_factory=list)
    cover_image_id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    is_public: bool = False
    tags: List[str] = field(default_factory=list)


class MediaService:
    """Comprehensive media asset management service."""

    def __init__(self):
        self.items: Dict[str, MediaItem] = {}
        self.folders: Dict[str, MediaFolder] = {}
        self.collections: Dict[str, MediaCollection] = {}
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Generate realistic sample media items."""
        sample_items = [
            ("nexus-dashboard-v2.png", MediaType.IMAGE, 2516582, "Screenshots",
             MediaMetadata(width=1920, height=1080, color_space="sRGB"),
             ["screenshot", "dashboard"], True),
            ("agent-demo-recording.mp4", MediaType.VIDEO, 47396044, "Videos",
             MediaMetadata(width=1920, height=1080, duration_seconds=222, frame_rate=30, codec="H.264"),
             ["demo", "agents"], False),
            ("notification-sound.mp3", MediaType.AUDIO, 430080, "Audio",
             MediaMetadata(duration_seconds=3, sample_rate=44100, channels=2, codec="MP3"),
             ["sound", "notification"], False),
            ("architecture-diagram.png", MediaType.IMAGE, 1887436, "Diagrams",
             MediaMetadata(width=2560, height=1440, color_space="sRGB"),
             ["diagram", "architecture"], True),
            ("onboarding-tutorial.mp4", MediaType.VIDEO, 126353817, "Videos",
             MediaMetadata(width=1920, height=1080, duration_seconds=750, frame_rate=30, codec="H.264"),
             ["tutorial", "onboarding"], False),
            ("profile-avatar.jpg", MediaType.IMAGE, 87040, "Avatars",
             MediaMetadata(width=256, height=256, color_space="sRGB"),
             ["avatar", "profile"], False),
            ("smart-home-overview.png", MediaType.IMAGE, 3250585, "Screenshots",
             MediaMetadata(width=3840, height=2160, color_space="sRGB"),
             ["home", "iot"], True),
            ("voice-sample-greeting.wav", MediaType.AUDIO, 1258291, "Audio",
             MediaMetadata(duration_seconds=8, sample_rate=48000, channels=1, codec="PCM"),
             ["voice", "tts"], False),
            ("deployment-flow.png", MediaType.IMAGE, 972800, "Diagrams",
             MediaMetadata(width=1600, height=900, color_space="sRGB"),
             ["diagram", "ci-cd"], False),
            ("ml-model-training.mp4", MediaType.VIDEO, 94058496, "Videos",
             MediaMetadata(width=1280, height=720, duration_seconds=495, frame_rate=24, codec="H.264"),
             ["ml", "training"], False),
            ("analytics-chart.svg", MediaType.IMAGE, 43008, "Icons",
             MediaMetadata(width=800, height=600),
             ["chart", "svg"], False),
            ("background-music.mp3", MediaType.AUDIO, 5662310, "Audio",
             MediaMetadata(duration_seconds=202, sample_rate=44100, channels=2, codec="MP3", bitrate=192000),
             ["music", "ambient"], True),
            ("nexus-logo.svg", MediaType.IMAGE, 12288, "Icons",
             MediaMetadata(width=512, height=512),
             ["logo", "brand"], True),
            ("error-log-screenshot.png", MediaType.IMAGE, 1153434, "Screenshots",
             MediaMetadata(width=1920, height=1080, color_space="sRGB"),
             ["debug", "logs"], False),
            ("api-flow-diagram.png", MediaType.IMAGE, 798720, "Diagrams",
             MediaMetadata(width=1440, height=900, color_space="sRGB"),
             ["api", "diagram"], False),
            ("feature-walkthrough.mp4", MediaType.VIDEO, 220200960, "Videos",
             MediaMetadata(width=1920, height=1080, duration_seconds=1125, frame_rate=30, codec="H.265"),
             ["feature", "walkthrough"], True),
        ]

        folder_names = ["Screenshots", "Videos", "Audio", "Diagrams", "Avatars", "Icons"]
        for fn in folder_names:
            folder = MediaFolder(name=fn, path=f"/{fn}", color=["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"][folder_names.index(fn)])
            self.folders[folder.id] = folder

        for name, mtype, size, folder, meta, tags, starred in sample_items:
            ext = name.rsplit(".", 1)[-1] if "." in name else ""
            mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
            item = MediaItem(
                name=name,
                original_name=name,
                type=mtype,
                mime_type=mime,
                extension=ext,
                size_bytes=size,
                file_path=f"/data/media/{folder}/{name}",
                folder=folder,
                tags=tags,
                starred=starred,
                metadata=meta,
                checksum=hashlib.md5(name.encode()).hexdigest(),
            )
            self.items[item.id] = item

        # Update folder counts
        for folder in self.folders.values():
            items_in_folder = [i for i in self.items.values() if i.folder == folder.name]
            folder.item_count = len(items_in_folder)
            folder.total_size_bytes = sum(i.size_bytes for i in items_in_folder)

        # Create a sample collection
        collection = MediaCollection(
            name="Dashboard Screenshots",
            description="Screenshots of dashboard iterations",
            item_ids=[i.id for i in self.items.values() if "screenshot" in i.tags][:5],
            tags=["dashboard", "ui"],
        )
        self.collections[collection.id] = collection

    def list_items(
        self,
        media_type: Optional[MediaType] = None,
        folder: Optional[str] = None,
        tags: Optional[List[str]] = None,
        starred: Optional[bool] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List media items with filtering and sorting."""
        items = list(self.items.values())

        if media_type:
            items = [i for i in items if i.type == media_type]
        if folder:
            items = [i for i in items if i.folder == folder]
        if starred is not None:
            items = [i for i in items if i.starred == starred]
        if tags:
            items = [i for i in items if any(t in i.tags for t in tags)]
        if search:
            q = search.lower()
            items = [i for i in items if q in i.name.lower() or q in i.description.lower() or any(q in t for t in i.tags)]

        # Sort
        reverse = sort_order == "desc"
        if sort_by == "name":
            items.sort(key=lambda i: i.name.lower(), reverse=reverse)
        elif sort_by == "size":
            items.sort(key=lambda i: i.size_bytes, reverse=reverse)
        elif sort_by == "type":
            items.sort(key=lambda i: i.type.value, reverse=reverse)
        else:
            items.sort(key=lambda i: i.created_at, reverse=reverse)

        total = len(items)
        items = items[offset : offset + limit]

        return [asdict(i) for i in items], total

    def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Get a single media item."""
        item = self.items.get(item_id)
        if item:
            item.views += 1
            return asdict(item)
        return None

    def create_item(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new media item."""
        name = data.get("name", "untitled")
        ext = name.rsplit(".", 1)[-1] if "." in name else ""
        mime = mimetypes.guess_type(name)[0] or "application/octet-stream"

        media_type = MediaType.OTHER
        if mime.startswith("image"):
            media_type = MediaType.IMAGE
        elif mime.startswith("video"):
            media_type = MediaType.VIDEO
        elif mime.startswith("audio"):
            media_type = MediaType.AUDIO

        item = MediaItem(
            name=name,
            original_name=name,
            type=media_type,
            mime_type=mime,
            extension=ext,
            size_bytes=data.get("size_bytes", 0),
            folder=data.get("folder", "Uncategorized"),
            tags=data.get("tags", []),
            description=data.get("description", ""),
            alt_text=data.get("alt_text", ""),
            uploaded_by=data.get("uploaded_by", "system"),
        )
        self.items[item.id] = item
        return asdict(item)

    def update_item(self, item_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update media item metadata."""
        item = self.items.get(item_id)
        if not item:
            return None

        for key in ["name", "folder", "tags", "description", "alt_text", "starred"]:
            if key in data:
                setattr(item, key, data[key])
        item.updated_at = datetime.now().isoformat()
        return asdict(item)

    def delete_item(self, item_id: str) -> bool:
        """Delete a media item."""
        if item_id in self.items:
            del self.items[item_id]
            # Remove from collections
            for coll in self.collections.values():
                if item_id in coll.item_ids:
                    coll.item_ids.remove(item_id)
            return True
        return False

    def toggle_star(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Toggle starred status."""
        item = self.items.get(item_id)
        if item:
            item.starred = not item.starred
            return asdict(item)
        return None

    def move_item(self, item_id: str, target_folder: str) -> Optional[Dict[str, Any]]:
        """Move item to a different folder."""
        item = self.items.get(item_id)
        if item:
            item.folder = target_folder
            item.updated_at = datetime.now().isoformat()
            return asdict(item)
        return None

    def bulk_action(self, item_ids: List[str], action: str, **kwargs) -> Dict[str, Any]:
        """Perform bulk action on multiple items."""
        results = {"success": 0, "failed": 0, "action": action}
        for item_id in item_ids:
            try:
                if action == "delete":
                    if self.delete_item(item_id):
                        results["success"] += 1
                    else:
                        results["failed"] += 1
                elif action == "star":
                    if self.toggle_star(item_id):
                        results["success"] += 1
                    else:
                        results["failed"] += 1
                elif action == "move":
                    folder = kwargs.get("folder", "Uncategorized")
                    if self.move_item(item_id, folder):
                        results["success"] += 1
                    else:
                        results["failed"] += 1
                elif action == "tag":
                    item = self.items.get(item_id)
                    if item:
                        new_tags = kwargs.get("tags", [])
                        item.tags = list(set(item.tags + new_tags))
                        results["success"] += 1
                    else:
                        results["failed"] += 1
            except Exception:
                results["failed"] += 1
        return results

    def list_folders(self) -> List[Dict[str, Any]]:
        """List all folders with stats."""
        result = []
        for folder in self.folders.values():
            items_in = [i for i in self.items.values() if i.folder == folder.name]
            folder.item_count = len(items_in)
            folder.total_size_bytes = sum(i.size_bytes for i in items_in)
            result.append(asdict(folder))
        return result

    def create_folder(self, name: str, parent_id: Optional[str] = None, color: str = "#8B5CF6") -> Dict[str, Any]:
        """Create a new folder."""
        folder = MediaFolder(name=name, parent_id=parent_id, path=f"/{name}", color=color)
        self.folders[folder.id] = folder
        return asdict(folder)

    def create_collection(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new media collection."""
        coll = MediaCollection(
            name=data.get("name", "Untitled"),
            description=data.get("description", ""),
            item_ids=data.get("item_ids", []),
            tags=data.get("tags", []),
        )
        self.collections[coll.id] = coll
        return asdict(coll)

    def list_collections(self) -> List[Dict[str, Any]]:
        """List all collections."""
        return [asdict(c) for c in self.collections.values()]

    def get_stats(self) -> Dict[str, Any]:
        """Get media library statistics."""
        items = list(self.items.values())
        type_counts = defaultdict(int)
        type_sizes = defaultdict(int)
        for item in items:
            type_counts[item.type.value] += 1
            type_sizes[item.type.value] += item.size_bytes

        return {
            "total_items": len(items),
            "total_size_bytes": sum(i.size_bytes for i in items),
            "by_type_count": dict(type_counts),
            "by_type_size": dict(type_sizes),
            "total_folders": len(self.folders),
            "total_collections": len(self.collections),
            "starred_count": sum(1 for i in items if i.starred),
            "total_tags": len(set(t for i in items for t in i.tags)),
        }

    def search(self, query: str) -> List[Dict[str, Any]]:
        """Full-text search across media items."""
        q = query.lower()
        results = []
        for item in self.items.values():
            score = 0
            if q in item.name.lower():
                score += 10
            if q in item.description.lower():
                score += 5
            if any(q in t for t in item.tags):
                score += 8
            if q in item.folder.lower():
                score += 3
            if score > 0:
                result = asdict(item)
                result["_search_score"] = score
                results.append(result)

        results.sort(key=lambda r: r["_search_score"], reverse=True)
        return results[:50]


# Singleton
_media_service: Optional[MediaService] = None


def get_media_service() -> MediaService:
    global _media_service
    if _media_service is None:
        _media_service = MediaService()
    return _media_service
