"""Migration directory patterns for all supported migration tools."""

# Each entry: name, glob pattern, optional exclude_names set.
MIGRATION_PATTERNS: list[dict] = [
    {"name": "alembic", "glob": "**/versions/*.py", "exclude": {"__init__.py"}},
    {"name": "prisma", "glob": "**/prisma/migrations/*/migration.sql", "exclude": set()},
    {"name": "drizzle", "glob": "**/drizzle/*.sql", "exclude": set()},
    {"name": "django", "glob": "**/migrations/*.py", "exclude": {"__init__.py"}},
    {"name": "rails", "glob": "**/db/migrate/*.rb", "exclude": set()},
    {"name": "knex", "glob": "**/migrations/*.{ts,js}", "exclude": set()},
    {"name": "hardhat", "glob": "**/deploy/*.ts", "exclude": set()},
    {"name": "foundry", "glob": "**/script/*.s.sol", "exclude": set()},
]
