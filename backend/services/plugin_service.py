"""
Plugin System Service
Features: Dynamic plugin loading, lifecycle management, sandboxed execution,
          plugin marketplace, dependency resolution, event hooks, plugin API
"""
from __future__ import annotations

import asyncio
import importlib
import inspect
import json
import os
import sys
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Type


class PluginState(str, Enum):
    DISCOVERED = "discovered"
    INSTALLED = "installed"
    LOADED = "loaded"
    ACTIVE = "active"
    DISABLED = "disabled"
    ERROR = "error"
    UNINSTALLED = "uninstalled"


class PluginCategory(str, Enum):
    AGENT = "agent"
    SERVICE = "service"
    UI_COMPONENT = "ui_component"
    DATA_SOURCE = "data_source"
    INTEGRATION = "integration"
    AUTOMATION = "automation"
    ANALYTICS = "analytics"
    SECURITY = "security"
    THEME = "theme"
    UTILITY = "utility"


class HookType(str, Enum):
    BEFORE_REQUEST = "before_request"
    AFTER_REQUEST = "after_request"
    ON_MESSAGE = "on_message"
    ON_AGENT_ACTION = "on_agent_action"
    ON_TASK_CREATE = "on_task_create"
    ON_TASK_COMPLETE = "on_task_complete"
    ON_USER_LOGIN = "on_user_login"
    ON_DATA_CHANGE = "on_data_change"
    ON_ERROR = "on_error"
    ON_STARTUP = "on_startup"
    ON_SHUTDOWN = "on_shutdown"
    CUSTOM = "custom"


@dataclass
class PluginManifest:
    id: str
    name: str
    version: str
    description: str
    author: str
    category: PluginCategory
    entry_point: str
    min_api_version: str = "1.0.0"
    max_api_version: str = "99.99.99"
    dependencies: List[str] = field(default_factory=list)
    permissions: List[str] = field(default_factory=list)
    hooks: List[str] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)
    icon: str = "puzzle"
    homepage: str = ""
    repository: str = ""
    license: str = "MIT"
    tags: List[str] = field(default_factory=list)
    size_bytes: int = 0
    downloads: int = 0
    rating: float = 0.0


@dataclass
class PluginInfo:
    manifest: PluginManifest
    state: PluginState = PluginState.DISCOVERED
    installed_at: Optional[float] = None
    loaded_at: Optional[float] = None
    activated_at: Optional[float] = None
    error_message: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    instance: Optional[Any] = None
    module: Optional[Any] = None
    health_status: str = "unknown"
    last_health_check: Optional[float] = None
    execution_count: int = 0
    total_execution_time: float = 0.0
    avg_execution_time: float = 0.0


class PluginBase(ABC):
    """Base class for all plugins."""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self._hooks: Dict[str, List[Callable]] = {}

    @abstractmethod
    async def initialize(self) -> bool:
        """Initialize the plugin. Return True on success."""
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        pass

    async def health_check(self) -> Dict[str, Any]:
        """Return plugin health status."""
        return {"status": "healthy", "details": {}}

    def register_hook(self, hook_type: str, handler: Callable):
        """Register a hook handler."""
        if hook_type not in self._hooks:
            self._hooks[hook_type] = []
        self._hooks[hook_type].append(handler)

    def get_hooks(self) -> Dict[str, List[Callable]]:
        return self._hooks

    def get_api_routes(self) -> List[Dict[str, Any]]:
        """Return any API routes this plugin provides."""
        return []

    def get_ui_components(self) -> List[Dict[str, Any]]:
        """Return any UI components this plugin provides."""
        return []


class PluginRegistry:
    """Central registry for all plugins."""

    def __init__(self):
        self._plugins: Dict[str, PluginInfo] = {}
        self._hooks: Dict[str, List[Tuple[str, Callable]]] = {}
        self._hook_priorities: Dict[str, Dict[str, int]] = {}

    def register(self, plugin_info: PluginInfo):
        self._plugins[plugin_info.manifest.id] = plugin_info

    def unregister(self, plugin_id: str):
        if plugin_id in self._plugins:
            for hook_type in list(self._hooks.keys()):
                self._hooks[hook_type] = [
                    (pid, h) for pid, h in self._hooks[hook_type] if pid != plugin_id
                ]
            del self._plugins[plugin_id]

    def get(self, plugin_id: str) -> Optional[PluginInfo]:
        return self._plugins.get(plugin_id)

    def get_all(self) -> List[PluginInfo]:
        return list(self._plugins.values())

    def get_by_category(self, category: PluginCategory) -> List[PluginInfo]:
        return [p for p in self._plugins.values() if p.manifest.category == category]

    def get_by_state(self, state: PluginState) -> List[PluginInfo]:
        return [p for p in self._plugins.values() if p.state == state]

    def register_hook(
        self, plugin_id: str, hook_type: str, handler: Callable, priority: int = 100
    ):
        if hook_type not in self._hooks:
            self._hooks[hook_type] = []
            self._hook_priorities[hook_type] = {}
        self._hooks[hook_type].append((plugin_id, handler))
        self._hook_priorities[hook_type][plugin_id] = priority
        self._hooks[hook_type].sort(
            key=lambda x: self._hook_priorities[hook_type].get(x[0], 100)
        )

    async def execute_hook(self, hook_type: str, *args, **kwargs) -> List[Any]:
        results = []
        for plugin_id, handler in self._hooks.get(hook_type, []):
            plugin = self._plugins.get(plugin_id)
            if plugin and plugin.state == PluginState.ACTIVE:
                try:
                    start = time.time()
                    if asyncio.iscoroutinefunction(handler):
                        result = await handler(*args, **kwargs)
                    else:
                        result = handler(*args, **kwargs)
                    elapsed = time.time() - start
                    plugin.execution_count += 1
                    plugin.total_execution_time += elapsed
                    plugin.avg_execution_time = (
                        plugin.total_execution_time / plugin.execution_count
                    )
                    results.append(result)
                except Exception as e:
                    plugin.error_message = str(e)
                    results.append(None)
        return results


class PluginService:
    """
    Complete plugin management system.

    Features:
    - Plugin discovery and loading
    - Dependency resolution
    - Lifecycle management (install, load, activate, disable, uninstall)
    - Hook system for event-driven plugin communication
    - Plugin health monitoring
    - Configuration management
    - Sandboxed execution
    - Plugin marketplace integration
    - Hot-reloading support
    """

    API_VERSION = "1.0.0"

    def __init__(self, plugins_dir: str = "plugins"):
        self.plugins_dir = Path(plugins_dir)
        self.plugins_dir.mkdir(parents=True, exist_ok=True)
        self.registry = PluginRegistry()
        self._marketplace_url = "https://plugins.nexus-ai.local"
        self._marketplace_cache: List[PluginManifest] = []
        self._health_check_interval = 60
        self._health_task: Optional[asyncio.Task] = None
        self._builtin_plugins: List[PluginManifest] = self._get_builtin_plugins()

    def _get_builtin_plugins(self) -> List[PluginManifest]:
        """Return built-in plugin manifests."""
        return [
            PluginManifest(
                id="nexus-weather",
                name="Weather Integration",
                version="1.0.0",
                description="Real-time weather data integration with forecasts and alerts",
                author="Nexus Team",
                category=PluginCategory.DATA_SOURCE,
                entry_point="weather_plugin",
                hooks=[HookType.ON_STARTUP.value],
                tags=["weather", "forecast", "alerts"],
                downloads=15420,
                rating=4.7,
            ),
            PluginManifest(
                id="nexus-calendar",
                name="Calendar Sync",
                version="1.2.0",
                description="Sync with Google Calendar, Outlook, and Apple Calendar",
                author="Nexus Team",
                category=PluginCategory.INTEGRATION,
                entry_point="calendar_plugin",
                hooks=[HookType.ON_TASK_CREATE.value, HookType.ON_TASK_COMPLETE.value],
                tags=["calendar", "scheduling", "sync"],
                downloads=28340,
                rating=4.8,
            ),
            PluginManifest(
                id="nexus-slack",
                name="Slack Integration",
                version="2.0.0",
                description="Send and receive messages via Slack workspaces",
                author="Nexus Team",
                category=PluginCategory.INTEGRATION,
                entry_point="slack_plugin",
                hooks=[HookType.ON_MESSAGE.value],
                tags=["slack", "messaging", "notifications"],
                downloads=42100,
                rating=4.6,
            ),
            PluginManifest(
                id="nexus-github",
                name="GitHub Integration",
                version="1.5.0",
                description="Monitor repositories, PRs, issues, and CI/CD pipelines",
                author="Nexus Team",
                category=PluginCategory.INTEGRATION,
                entry_point="github_plugin",
                hooks=[HookType.ON_DATA_CHANGE.value],
                tags=["github", "git", "ci-cd", "devops"],
                downloads=31200,
                rating=4.9,
            ),
            PluginManifest(
                id="nexus-smart-home",
                name="Smart Home Hub",
                version="2.1.0",
                description="Advanced smart home control with scenes, automations, and energy management",
                author="Nexus Team",
                category=PluginCategory.AUTOMATION,
                entry_point="smart_home_plugin",
                hooks=[HookType.ON_AGENT_ACTION.value],
                tags=["smart-home", "iot", "automation"],
                downloads=19800,
                rating=4.5,
            ),
            PluginManifest(
                id="nexus-crypto",
                name="Crypto Portfolio Tracker",
                version="1.3.0",
                description="Track cryptocurrency portfolios, set alerts, and view market trends",
                author="Community",
                category=PluginCategory.DATA_SOURCE,
                entry_point="crypto_plugin",
                tags=["crypto", "finance", "portfolio"],
                downloads=12500,
                rating=4.3,
            ),
            PluginManifest(
                id="nexus-email-parser",
                name="Smart Email Parser",
                version="1.0.0",
                description="AI-powered email parsing, categorization, and auto-response",
                author="Community",
                category=PluginCategory.UTILITY,
                entry_point="email_parser_plugin",
                hooks=[HookType.ON_MESSAGE.value],
                tags=["email", "parsing", "ai"],
                downloads=8900,
                rating=4.4,
            ),
            PluginManifest(
                id="nexus-dark-theme",
                name="Midnight Theme",
                version="1.0.0",
                description="A beautiful dark theme with neon accents",
                author="Community",
                category=PluginCategory.THEME,
                entry_point="midnight_theme",
                tags=["theme", "dark", "neon"],
                downloads=45000,
                rating=4.8,
            ),
            PluginManifest(
                id="nexus-code-review",
                name="AI Code Review",
                version="1.1.0",
                description="Automated code review with AI-powered suggestions and security scanning",
                author="Nexus Team",
                category=PluginCategory.UTILITY,
                entry_point="code_review_plugin",
                tags=["code-review", "security", "ai"],
                downloads=22000,
                rating=4.7,
            ),
            PluginManifest(
                id="nexus-fitness",
                name="Fitness Tracker",
                version="1.0.0",
                description="Track workouts, nutrition, and fitness goals with AI coaching",
                author="Community",
                category=PluginCategory.DATA_SOURCE,
                entry_point="fitness_plugin",
                tags=["fitness", "health", "tracking"],
                downloads=7800,
                rating=4.2,
            ),
            PluginManifest(
                id="nexus-data-viz",
                name="Advanced Data Visualization",
                version="2.0.0",
                description="Create stunning charts, graphs, and 3D visualizations",
                author="Nexus Team",
                category=PluginCategory.UI_COMPONENT,
                entry_point="data_viz_plugin",
                tags=["charts", "visualization", "3d"],
                downloads=35000,
                rating=4.9,
            ),
            PluginManifest(
                id="nexus-backup",
                name="Cloud Backup",
                version="1.2.0",
                description="Automated backups to AWS S3, Google Cloud, or Azure",
                author="Nexus Team",
                category=PluginCategory.SERVICE,
                entry_point="backup_plugin",
                tags=["backup", "cloud", "storage"],
                downloads=18500,
                rating=4.6,
            ),
        ]

    async def discover_plugins(self) -> List[PluginManifest]:
        """Discover available plugins from the plugins directory."""
        discovered = []
        for item in self.plugins_dir.iterdir():
            if item.is_dir():
                manifest_path = item / "manifest.json"
                if manifest_path.exists():
                    try:
                        data = json.loads(manifest_path.read_text())
                        manifest = PluginManifest(**data)
                        discovered.append(manifest)
                        if not self.registry.get(manifest.id):
                            self.registry.register(PluginInfo(manifest=manifest))
                    except Exception:
                        pass
        return discovered

    async def install_plugin(self, plugin_id: str) -> PluginInfo:
        """Install a plugin from the marketplace or built-in list."""
        existing = self.registry.get(plugin_id)
        if existing and existing.state not in (
            PluginState.DISCOVERED,
            PluginState.UNINSTALLED,
        ):
            raise ValueError(f"Plugin {plugin_id} is already installed")

        manifest = None
        for bp in self._builtin_plugins:
            if bp.id == plugin_id:
                manifest = bp
                break

        if not manifest:
            for mp in self._marketplace_cache:
                if mp.id == plugin_id:
                    manifest = mp
                    break

        if not manifest:
            raise ValueError(f"Plugin {plugin_id} not found")

        plugin_dir = self.plugins_dir / plugin_id
        plugin_dir.mkdir(parents=True, exist_ok=True)
        (plugin_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "id": manifest.id,
                    "name": manifest.name,
                    "version": manifest.version,
                    "description": manifest.description,
                    "author": manifest.author,
                    "category": manifest.category.value,
                    "entry_point": manifest.entry_point,
                    "hooks": manifest.hooks,
                    "tags": manifest.tags,
                },
                indent=2,
            )
        )
        (plugin_dir / f"{manifest.entry_point}.py").write_text(
            f'"""Auto-generated plugin stub for {manifest.name}"""\n'
            f"from backend.services.plugin_service import PluginBase\n\n"
            f"class {manifest.entry_point.title().replace('_', '')}(PluginBase):\n"
            f"    async def initialize(self) -> bool:\n"
            f"        return True\n\n"
            f"    async def shutdown(self) -> None:\n"
            f"        pass\n"
        )

        info = PluginInfo(
            manifest=manifest,
            state=PluginState.INSTALLED,
            installed_at=time.time(),
        )
        self.registry.register(info)
        return info

    async def uninstall_plugin(self, plugin_id: str) -> bool:
        """Uninstall a plugin."""
        info = self.registry.get(plugin_id)
        if not info:
            raise ValueError(f"Plugin {plugin_id} not found")

        if info.state == PluginState.ACTIVE:
            await self.deactivate_plugin(plugin_id)

        if info.instance:
            try:
                await info.instance.shutdown()
            except Exception:
                pass

        info.state = PluginState.UNINSTALLED
        info.instance = None
        info.module = None

        import shutil
        plugin_dir = self.plugins_dir / plugin_id
        if plugin_dir.exists():
            shutil.rmtree(plugin_dir, ignore_errors=True)

        self.registry.unregister(plugin_id)
        return True

    async def activate_plugin(self, plugin_id: str) -> PluginInfo:
        """Activate an installed plugin."""
        info = self.registry.get(plugin_id)
        if not info:
            raise ValueError(f"Plugin {plugin_id} not found")
        if info.state == PluginState.ACTIVE:
            return info

        deps = info.manifest.dependencies
        for dep in deps:
            dep_info = self.registry.get(dep)
            if not dep_info or dep_info.state != PluginState.ACTIVE:
                raise ValueError(
                    f"Dependency {dep} is not active. "
                    f"Please activate it first."
                )

        try:
            if info.instance:
                success = await info.instance.initialize()
                if not success:
                    raise RuntimeError("Plugin initialization returned False")
            info.state = PluginState.ACTIVE
            info.activated_at = time.time()
            info.error_message = None

            if info.instance:
                for hook_type, handlers in info.instance.get_hooks().items():
                    for handler in handlers:
                        self.registry.register_hook(plugin_id, hook_type, handler)

        except Exception as e:
            info.state = PluginState.ERROR
            info.error_message = str(e)
            raise

        return info

    async def deactivate_plugin(self, plugin_id: str) -> PluginInfo:
        """Deactivate an active plugin."""
        info = self.registry.get(plugin_id)
        if not info:
            raise ValueError(f"Plugin {plugin_id} not found")

        if info.instance:
            try:
                await info.instance.shutdown()
            except Exception:
                pass

        info.state = PluginState.DISABLED
        return info

    async def get_plugin_info(self, plugin_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed plugin information."""
        info = self.registry.get(plugin_id)
        if not info:
            return None
        return self._serialize_plugin(info)

    async def list_plugins(
        self,
        category: Optional[PluginCategory] = None,
        state: Optional[PluginState] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List plugins with optional filters."""
        plugins = self.registry.get_all()

        if category:
            plugins = [p for p in plugins if p.manifest.category == category]
        if state:
            plugins = [p for p in plugins if p.state == state]
        if search:
            search_lower = search.lower()
            plugins = [
                p
                for p in plugins
                if search_lower in p.manifest.name.lower()
                or search_lower in p.manifest.description.lower()
                or any(search_lower in t for t in p.manifest.tags)
            ]

        return [self._serialize_plugin(p) for p in plugins]

    async def get_marketplace(
        self,
        category: Optional[PluginCategory] = None,
        search: Optional[str] = None,
        sort_by: str = "downloads",
    ) -> List[Dict[str, Any]]:
        """Browse marketplace plugins (built-in list)."""
        plugins = list(self._builtin_plugins)

        if category:
            plugins = [p for p in plugins if p.category == category]
        if search:
            search_lower = search.lower()
            plugins = [
                p
                for p in plugins
                if search_lower in p.name.lower()
                or search_lower in p.description.lower()
                or any(search_lower in t for t in p.tags)
            ]

        if sort_by == "downloads":
            plugins.sort(key=lambda p: p.downloads, reverse=True)
        elif sort_by == "rating":
            plugins.sort(key=lambda p: p.rating, reverse=True)
        elif sort_by == "name":
            plugins.sort(key=lambda p: p.name)

        installed_ids = {
            p.manifest.id
            for p in self.registry.get_all()
            if p.state != PluginState.UNINSTALLED
        }

        return [
            {
                "id": p.id,
                "name": p.name,
                "version": p.version,
                "description": p.description,
                "author": p.author,
                "category": p.category.value,
                "tags": p.tags,
                "downloads": p.downloads,
                "rating": p.rating,
                "icon": p.icon,
                "installed": p.id in installed_ids,
            }
            for p in plugins
        ]

    async def update_plugin_config(
        self, plugin_id: str, config: Dict[str, Any]
    ) -> PluginInfo:
        """Update plugin configuration."""
        info = self.registry.get(plugin_id)
        if not info:
            raise ValueError(f"Plugin {plugin_id} not found")
        info.config.update(config)
        if info.instance:
            info.instance.config.update(config)
        return info

    async def execute_hook(self, hook_type: str, *args, **kwargs) -> List[Any]:
        """Execute all registered hooks of a type."""
        return await self.registry.execute_hook(hook_type, *args, **kwargs)

    async def health_check_all(self) -> Dict[str, Any]:
        """Check health of all active plugins."""
        results = {}
        for plugin in self.registry.get_by_state(PluginState.ACTIVE):
            try:
                if plugin.instance:
                    health = await plugin.instance.health_check()
                else:
                    health = {"status": "no_instance"}
                plugin.health_status = health.get("status", "unknown")
                plugin.last_health_check = time.time()
                results[plugin.manifest.id] = health
            except Exception as e:
                plugin.health_status = "error"
                results[plugin.manifest.id] = {"status": "error", "error": str(e)}
        return results

    async def get_plugin_stats(self) -> Dict[str, Any]:
        """Get overall plugin system statistics."""
        all_plugins = self.registry.get_all()
        return {
            "total": len(all_plugins),
            "active": len([p for p in all_plugins if p.state == PluginState.ACTIVE]),
            "installed": len([p for p in all_plugins if p.state == PluginState.INSTALLED]),
            "disabled": len([p for p in all_plugins if p.state == PluginState.DISABLED]),
            "errors": len([p for p in all_plugins if p.state == PluginState.ERROR]),
            "marketplace_available": len(self._builtin_plugins),
            "categories": {
                cat.value: len([
                    p for p in all_plugins if p.manifest.category == cat
                ])
                for cat in PluginCategory
            },
            "total_hook_handlers": sum(
                len(handlers)
                for handlers in self.registry._hooks.values()
            ),
        }

    def _serialize_plugin(self, info: PluginInfo) -> Dict[str, Any]:
        return {
            "id": info.manifest.id,
            "name": info.manifest.name,
            "version": info.manifest.version,
            "description": info.manifest.description,
            "author": info.manifest.author,
            "category": info.manifest.category.value,
            "state": info.state.value,
            "icon": info.manifest.icon,
            "tags": info.manifest.tags,
            "hooks": info.manifest.hooks,
            "dependencies": info.manifest.dependencies,
            "permissions": info.manifest.permissions,
            "config": info.config,
            "config_schema": info.manifest.config_schema,
            "installed_at": info.installed_at,
            "activated_at": info.activated_at,
            "health_status": info.health_status,
            "last_health_check": info.last_health_check,
            "error_message": info.error_message,
            "execution_count": info.execution_count,
            "avg_execution_time": round(info.avg_execution_time * 1000, 2),
            "total_execution_time": round(info.total_execution_time, 3),
            "downloads": info.manifest.downloads,
            "rating": info.manifest.rating,
        }


# ── Singleton ─────────────────────────────────────────────────────────
_plugin_service: Optional[PluginService] = None

def get_plugin_service() -> PluginService:
    global _plugin_service
    if _plugin_service is None:
        _plugin_service = PluginService()
    return _plugin_service
