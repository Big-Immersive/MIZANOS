"""Artifact extractor — orchestrates multi-stack extraction."""

from pathlib import Path

from apps.api.services.extraction.pattern_runner import (
    iter_files,
    run_class_patterns,
    run_regex_patterns,
    should_skip,
)
from apps.api.services.extraction.route_patterns import (
    FILE_ROUTE_PATTERNS,
    ROUTE_PATTERNS,
)
from apps.api.services.extraction.model_patterns import MODEL_PATTERNS
from apps.api.services.extraction.schema_patterns import SCHEMA_PATTERNS
from apps.api.services.extraction.component_patterns import (
    COMPONENT_PATTERNS,
    PAGE_PATTERNS,
)
from apps.api.services.extraction.dependency_parsers import parse_all_dependencies
from apps.api.services.extraction.migration_patterns import MIGRATION_PATTERNS
from apps.api.services.extraction.config_patterns import CONFIG_ENTRIES
from apps.api.services.extraction.pattern_runner import expand_globs

_CODE_EXTS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".vue", ".svelte", ".astro",
    ".sol", ".go", ".rs", ".java", ".kt", ".rb", ".php",
    ".prisma", ".graphql", ".proto",
    ".html", ".css", ".scss",
}


class ArtifactExtractor:
    """Extracts surface-level code artifacts without reading function internals."""

    def extract(self, repo_path: str) -> dict:
        root = Path(repo_path)
        return {
            "file_tree": self._extract_file_tree(root),
            "routes": self._extract_routes(root),
            "models": run_class_patterns(root, MODEL_PATTERNS),
            "schemas": run_class_patterns(root, SCHEMA_PATTERNS),
            "components": self._extract_components(root),
            "pages": self._extract_pages(root),
            "dependencies": parse_all_dependencies(root),
            "migrations": self._extract_migrations(root),
            "configs": self._extract_configs(root),
        }

    def _extract_file_tree(self, root: Path, max_depth: int = 4) -> list[str]:
        """Flat list of relative code file paths (filtered, limited depth)."""
        result: list[str] = []
        for item in sorted(root.rglob("*")):
            if should_skip(item):
                continue
            rel = item.relative_to(root)
            if len(rel.parts) > max_depth:
                continue
            if item.is_file() and item.suffix in _CODE_EXTS:
                result.append(str(rel))
        return result

    def _extract_routes(self, root: Path) -> list[dict]:
        """Find routes via regex patterns + file-presence conventions."""
        routes = run_regex_patterns(root, ROUTE_PATTERNS)
        for pat in FILE_ROUTE_PATTERNS:
            routes.extend(self._find_file_routes(root, pat))
        return sorted(routes, key=lambda r: r.get("file", r.get("route", "")))

    def _find_file_routes(self, root: Path, pat: dict) -> list[dict]:
        """Find routes from file-system conventions (Next.js app/, SvelteKit, etc.)."""
        results: list[dict] = []
        for base_dir in root.rglob(pat["base_dir_glob"]):
            if not base_dir.is_dir() or should_skip(base_dir):
                continue
            for f in iter_files(base_dir, pat["file_glob"]):
                rel = f.relative_to(base_dir)
                route = "/" + "/".join(rel.parent.parts)
                results.append({
                    "route": route,
                    "file": str(f.relative_to(root)),
                })
        return results

    def _extract_components(self, root: Path) -> list[dict]:
        """Find UI components by extension + directory keyword."""
        results: list[dict] = []
        for pat in COMPONENT_PATTERNS:
            for ext in pat["extensions"]:
                for f in sorted(root.rglob(f"*{ext}")):
                    if should_skip(f):
                        continue
                    rel = str(f.relative_to(root)).lower()
                    if any(kw in rel for kw in pat["dir_keywords"]):
                        results.append({"name": f.stem, "file": str(f.relative_to(root))})
        return results

    def _extract_pages(self, root: Path) -> list[dict]:
        """Find page files from conventional directories."""
        results: list[dict] = []
        for pat in PAGE_PATTERNS:
            for pages_dir in sorted(root.rglob(pat["dir_name"])):
                if should_skip(pages_dir) or not pages_dir.is_dir():
                    continue
                for f in sorted(pages_dir.rglob("*")):
                    if f.is_file() and f.suffix in pat["extensions"]:
                        results.append({
                            "route": "/" + str(f.relative_to(pages_dir).with_suffix("")),
                            "file": str(f.relative_to(root)),
                        })
        return results

    def _extract_migrations(self, root: Path) -> list[dict]:
        """Find migration files from all supported migration tools."""
        results: list[dict] = []
        seen: set[str] = set()
        for pat in MIGRATION_PATTERNS:
            exclude = pat.get("exclude", set())
            for glob_str in expand_globs(pat["glob"]):
                for f in sorted(root.glob(glob_str)):
                    if should_skip(f) or not f.is_file() or f.name in exclude:
                        continue
                    rel = str(f.relative_to(root))
                    if rel not in seen:
                        seen.add(rel)
                        results.append({"name": f.stem, "file": rel})
        return results

    def _extract_configs(self, root: Path) -> list[dict]:
        """Check for presence of known config files."""
        results: list[dict] = []
        for cfg in CONFIG_ENTRIES:
            if "*" in cfg["path"]:
                exists = bool(list(root.glob(cfg["path"])))
            else:
                exists = (root / cfg["path"]).exists()
            results.append({
                "type": cfg["type"],
                "file": cfg["path"],
                "exists": exists,
            })
        return results
