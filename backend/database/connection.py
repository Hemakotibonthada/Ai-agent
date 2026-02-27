# NEXUS AI - Database Connection Manager
"""
Async SQLite database connection management using SQLAlchemy.
Includes connection pooling, migrations, and health checks.
"""

import asyncio
from pathlib import Path
from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager
from loguru import logger
from sqlalchemy.ext.asyncio import (
    AsyncSession, AsyncEngine,
    create_async_engine, async_sessionmaker,
)
from sqlalchemy.pool import StaticPool
from sqlalchemy import text, event

from .models import Base


class DatabaseManager:
    """
    Manages database connections, session lifecycle, and migrations.
    """

    def __init__(self, db_path: str = "./data/nexus.db"):
        self._db_path = db_path
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[async_sessionmaker] = None
        self._initialized = False

        # Ensure directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    async def initialize(self):
        """Initialize the database engine and create tables."""
        if self._initialized:
            return

        db_url = f"sqlite+aiosqlite:///{self._db_path}"

        self._engine = create_async_engine(
            db_url,
            echo=False,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        # Create all tables
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        self._initialized = True
        logger.info(f"Database initialized: {self._db_path}")

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session with automatic commit/rollback."""
        if not self._session_factory:
            await self.initialize()

        session = self._session_factory()
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()

    async def execute_raw(self, query: str, params: dict = None) -> list:
        """Execute a raw SQL query."""
        async with self.get_session() as session:
            result = await session.execute(text(query), params or {})
            return result.fetchall()

    async def health_check(self) -> dict:
        """Check database health."""
        try:
            async with self.get_session() as session:
                result = await session.execute(text("SELECT 1"))
                row = result.fetchone()
                return {
                    "status": "healthy" if row else "unhealthy",
                    "database": self._db_path,
                    "initialized": self._initialized,
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "database": self._db_path,
            }

    async def backup(self, backup_path: str):
        """Create a backup of the database."""
        import shutil
        try:
            Path(backup_path).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(self._db_path, backup_path)
            logger.info(f"Database backed up to: {backup_path}")
        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            raise

    async def close(self):
        """Close the database engine."""
        if self._engine:
            await self._engine.dispose()
            self._initialized = False
            logger.info("Database connection closed")


# Global database manager instance
db_manager = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions."""
    async with db_manager.get_session() as session:
        yield session
