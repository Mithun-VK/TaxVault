from typing import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings


def _build_engine() -> AsyncEngine:
    kwargs: dict = {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_recycle": settings.DB_POOL_RECYCLE,
        "pool_pre_ping": True,
        "echo": settings.DEBUG,
    }

    # Supabase transaction pooler / pgBouncer (port 6543) does not support
    # server-side prepared statements. Safe to set on direct connections too.
    url = settings.DATABASE_URL
    if any(tok in url for tok in ("supabase", "pgbouncer", ":6543", "pooler")):
        kwargs["connect_args"] = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            # The pooler shares one physical backend across many asyncpg
            # connections. asyncpg names prepared statements sequentially
            # (__asyncpg_stmt_N__), so those names collide across pooled
            # connections -> DuplicatePreparedStatementError. A unique name
            # per statement makes collisions impossible.
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        }

    return create_async_engine(url, **kwargs)


engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
