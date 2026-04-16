"""Cleanup for chatbot messages.

Two modes:
  --ghost-only   : delete only spec-schema JSON-dump assistant messages
  --all          : nuke EVERY message and EVERY session (clean slate)

Run --dry-run first to see counts before --commit.

Usage:
    python scripts/cleanup_chat_ghost_messages.py --ghost-only --dry-run
    python scripts/cleanup_chat_ghost_messages.py --ghost-only --commit
    python scripts/cleanup_chat_ghost_messages.py --all --dry-run
    python scripts/cleanup_chat_ghost_messages.py --all --commit

Connects via DATABASE_URL env var (same one the api uses).
"""

import argparse
import asyncio
import os
import sys

import asyncpg


SPEC_MARKERS = (
    "qaChecklist",
    "nonFunctionalRequirements",
    "techStack",
    "acceptance_criteria",
    "userStories",
    "businessRules",
    "acceptanceCriteria",
    "functionalSpec",
    "technicalSpec",
)


def _ghost_count_sql() -> str:
    marker_clause = " OR ".join(
        f"substr(content, 1, 2000) LIKE '%' || $${m}$$ || '%'"
        for m in SPEC_MARKERS
    )
    return f"""
        SELECT COUNT(*)
        FROM ai_chat_messages
        WHERE role = 'assistant'
          AND LENGTH(content) >= 40
          AND (
              substr(TRIM(LEADING ' ' FROM content), 1, 1) = '{{'
              OR substr(TRIM(LEADING ' ' FROM content), 1, 1) = '['
          )
          AND ({marker_clause})
    """


async def run_ghost_only(conn: asyncpg.Connection, commit: bool) -> None:
    count_sql = _ghost_count_sql()
    count = await conn.fetchval(count_sql)
    print(f"Ghost spec-JSON assistant messages found: {count}")
    if count == 0:
        print("Nothing to delete.")
        return
    if not commit:
        print("Dry run — no rows deleted. Rerun with --commit to delete.")
        return
    delete_sql = count_sql.replace("SELECT COUNT(*)", "DELETE")
    deleted = await conn.execute(delete_sql)
    print(f"Deleted: {deleted}")


async def run_all(conn: asyncpg.Connection, commit: bool) -> None:
    msg_count = await conn.fetchval("SELECT COUNT(*) FROM ai_chat_messages")
    sess_count = await conn.fetchval("SELECT COUNT(*) FROM ai_chat_sessions")
    print(f"All messages: {msg_count}")
    print(f"All sessions: {sess_count}")
    if msg_count == 0 and sess_count == 0:
        print("Nothing to delete.")
        return
    if not commit:
        print("Dry run — no rows deleted. Rerun with --commit to nuke everything.")
        return
    # Order matters — delete child rows first to avoid FK violations.
    deleted_msgs = await conn.execute("DELETE FROM ai_chat_messages")
    deleted_sess = await conn.execute("DELETE FROM ai_chat_sessions")
    print(f"Deleted messages: {deleted_msgs}")
    print(f"Deleted sessions: {deleted_sess}")


async def run(mode: str, commit: bool) -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL env var not set", file=sys.stderr)
        sys.exit(1)
    url = url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(url)
    try:
        if mode == "ghost-only":
            await run_ghost_only(conn, commit)
        else:
            await run_all(conn, commit)
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--ghost-only", action="store_true", help="delete only spec-JSON dumps")
    mode.add_argument("--all", action="store_true", help="nuke every message and session")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--dry-run", action="store_true", help="count only, no delete")
    action.add_argument("--commit", action="store_true", help="actually delete")
    args = parser.parse_args()
    selected_mode = "ghost-only" if args.ghost_only else "all"
    asyncio.run(run(mode=selected_mode, commit=args.commit))


if __name__ == "__main__":
    main()
