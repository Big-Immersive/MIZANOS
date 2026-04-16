"""One-off cleanup for ghost chatbot messages.

Removes assistant messages whose content is a spec-schema JSON dump
(the pattern that predates the backend disconnect-detection fix and
the streaming sanitizer). Run against dev first to confirm the row
count, then run against production.

Usage:
    python scripts/cleanup_chat_ghost_messages.py --dry-run      # count only
    python scripts/cleanup_chat_ghost_messages.py --commit       # actually delete

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


async def run(commit: bool) -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL env var not set", file=sys.stderr)
        sys.exit(1)

    # asyncpg doesn't accept SQLAlchemy-style drivers
    url = url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(url)
    try:
        # Count candidates: assistant messages that start with a bracket
        # AND contain at least one spec-schema marker in the first 2000 chars.
        marker_clause = " OR ".join(
            f"substr(content, 1, 2000) LIKE '%' || $${m}$$ || '%'"
            for m in SPEC_MARKERS
        )
        count_sql = f"""
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
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="count only, no delete")
    group.add_argument("--commit", action="store_true", help="actually delete")
    args = parser.parse_args()
    asyncio.run(run(commit=args.commit))


if __name__ == "__main__":
    main()
