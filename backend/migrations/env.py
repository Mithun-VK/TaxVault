import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.base import Base  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Read the migration connection URL from the environment - never hardcode
# credentials in tracked files. Prefer the direct (non-pooler) URL, since DDL
# and prepared-statement-heavy migrations should not run through pgBouncer.
# make_url handles any '@' in the password without string-parsing issues.
def _resolve_db_url():
    raw = os.environ.get("DIRECT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not raw:
        raise RuntimeError(
            "DIRECT_DATABASE_URL (or DATABASE_URL) must be set to run migrations. "
            "Copy backend/.env.example to backend/.env and set it."
        )
    url = make_url(raw)
    # Migrations run on the async engine, so force the asyncpg driver.
    if url.drivername in ("postgresql", "postgres"):
        url = url.set(drivername="postgresql+asyncpg")
    return url


db_url = _resolve_db_url()


def run_migrations_offline() -> None:
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(
        db_url,
        poolclass=pool.NullPool,
        connect_args={"statement_cache_size": 0},
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()