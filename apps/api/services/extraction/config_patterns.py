"""Config file presence patterns."""

# Each entry: type label, file path or glob pattern.
# Glob patterns (with *) are resolved via Path.glob(); exact paths use Path.exists().
CONFIG_ENTRIES: list[dict] = [
    # Build / infrastructure
    {"type": "docker-compose", "path": "docker-compose.yml"},
    {"type": "docker-compose", "path": "docker-compose.yaml"},
    {"type": "dockerfile", "path": "Dockerfile"},
    {"type": "env-example", "path": ".env.example"},
    {"type": "ci-github", "path": ".github/workflows"},
    {"type": "makefile", "path": "Makefile"},
    # JavaScript / TypeScript
    {"type": "tsconfig", "path": "tsconfig.json"},
    {"type": "vite", "path": "vite.config.*"},
    {"type": "next", "path": "next.config.*"},
    {"type": "nuxt", "path": "nuxt.config.*"},
    {"type": "svelte", "path": "svelte.config.*"},
    {"type": "tailwind", "path": "tailwind.config.*"},
    # Python
    {"type": "pyproject", "path": "pyproject.toml"},
    # Blockchain
    {"type": "hardhat", "path": "hardhat.config.*"},
    {"type": "foundry", "path": "foundry.toml"},
    # ORM schemas
    {"type": "prisma-schema", "path": "prisma/schema.prisma"},
]
