"""Route extraction pattern definitions for all supported frameworks."""

# Regex-based route patterns.
# Each entry: name, file_glob, regex, group_map (output key -> capture group index).
ROUTE_PATTERNS: list[dict] = [
    # --- Python ---
    {
        "name": "fastapi",
        "file_glob": "*.py",
        "regex": r'@(?:router|app)\.(get|post|put|patch|delete)\(\s*["\']([^"\']+)',
        "group_map": {"method": 1, "path": 2},
        "handler_lookahead": r"(?:async\s+)?def\s+(\w+)",
    },
    {
        "name": "flask",
        "file_glob": "*.py",
        "regex": r'@(?:app|blueprint|bp)\.route\(\s*["\']([^"\']+)["\']'
                 r'(?:.*methods\s*=\s*\[([^\]]+)\])?',
        "group_map": {"path": 1, "method": 2},
        "handler_lookahead": r"(?:async\s+)?def\s+(\w+)",
    },
    {
        "name": "django",
        "file_glob": "urls.py",
        "regex": r'path\(\s*["\']([^"\']*)["\']',
        "group_map": {"path": 1},
    },
    # --- JavaScript / TypeScript ---
    {
        "name": "express",
        "file_glob": "*.{ts,js}",
        "regex": r'(?:app|router)\.(get|post|put|patch|delete)\(\s*["\']([^"\']+)',
        "group_map": {"method": 1, "path": 2},
        "handler_lookahead": r"(?:async\s+)?(?:function\s+)?(\w+)",
    },
    # --- Ruby ---
    {
        "name": "rails",
        "file_glob": "routes.rb",
        "regex": r'(?:get|post|put|patch|delete)\s+["\']([^"\']+)',
        "group_map": {"path": 1},
    },
    {
        "name": "rails_resources",
        "file_glob": "routes.rb",
        "regex": r'resources?\s+:(\w+)',
        "group_map": {"path": 1},
    },
]

# File-presence route patterns (framework conventions).
# Each entry: name, base_dir_glob, file_glob.
# Route is derived from file path relative to base dir.
FILE_ROUTE_PATTERNS: list[dict] = [
    {
        "name": "nextjs_app",
        "base_dir_glob": "app",
        "file_glob": "page.*",
    },
    {
        "name": "sveltekit",
        "base_dir_glob": "src/routes",
        "file_glob": "+page.svelte",
    },
    {
        "name": "sveltekit_api",
        "base_dir_glob": "src/routes",
        "file_glob": "+server.{ts,js}",
    },
    {
        "name": "nuxt_pages",
        "base_dir_glob": "pages",
        "file_glob": "*.vue",
    },
    {
        "name": "nuxt_api",
        "base_dir_glob": "server/api",
        "file_glob": "*.{ts,js}",
    },
]
