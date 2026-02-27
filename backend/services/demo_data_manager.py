"""
Demo Data Manager
Controls whether backend services initialize with sample/demo data.
Demo data is only populated for demo user sessions.
"""
from __future__ import annotations

import os
from typing import Optional


class DemoDataManager:
    """Singleton that controls demo data availability in services."""

    _instance: Optional['DemoDataManager'] = None

    def __new__(cls) -> 'DemoDataManager':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        # Demo data is enabled by default so the demo account has data to show.
        # Services tag their demo data so it can be filtered per-user.
        self._enabled = os.getenv("NEXUS_DEMO_DATA", "true").lower() in ("1", "true", "yes")

    @property
    def enabled(self) -> bool:
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        self._enabled = value

    def should_load_demo_data(self) -> bool:
        """Returns True if services should load sample/demo data at init."""
        return self._enabled


_manager: Optional[DemoDataManager] = None


def get_demo_data_manager() -> DemoDataManager:
    global _manager
    if _manager is None:
        _manager = DemoDataManager()
    return _manager


def is_demo_data_enabled() -> bool:
    """Quick helper to check if demo data should be loaded."""
    return get_demo_data_manager().should_load_demo_data()
