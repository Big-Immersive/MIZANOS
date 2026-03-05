"""Generic pattern matching engine for multi-stack artifact extraction."""

from __future__ import annotations

import re
from pathlib import Path

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "target", "vendor",
    ".cache", "coverage", ".turbo", ".tox", "egg-info",
}


def should_skip(path: Path) -> bool:
    """Check if any path component is in the skip list."""
    return any(part in SKIP_DIRS for part in path.parts)


def expand_globs(glob_str: str) -> list[str]:
    """Expand brace syntax into multiple globs.

    '*.{ts,js}' -> ['*.ts', '*.js']
    '*.py'      -> ['*.py']
    """
    match = re.match(r"^(.*)\{([^}]+)\}(.*)$", glob_str)
    if not match:
        return [glob_str]
    prefix, alternatives, suffix = match.group(1), match.group(2), match.group(3)
    return [f"{prefix}{alt.strip()}{suffix}" for alt in alternatives.split(",")]


def iter_files(root: Path, glob_str: str):
    """Yield files matching glob pattern, skipping excluded dirs."""
    for pattern in expand_globs(glob_str):
        for f in root.rglob(pattern):
            if f.is_file() and not should_skip(f):
                yield f


def safe_read(path: Path) -> str | None:
    """Read file text, returning None on error."""
    try:
        return path.read_text(errors="replace")
    except OSError:
        return None


def find_block_end(text: str, start: int) -> int:
    """Find end of a class/block body (next top-level declaration or EOF)."""
    lines = text[start:].split("\n")
    pos = start
    for i, line in enumerate(lines):
        if i == 0:
            continue
        if line and not line[0].isspace() and line.strip():
            return pos
        pos += len(line) + 1
    return len(text)


def run_regex_patterns(root: Path, patterns: list[dict]) -> list[dict]:
    """Run regex-based patterns against matching files.

    Each pattern dict must have:
      - file_glob: str (e.g. '*.py', '*.{ts,js}')
      - regex: str (compiled per run)
      - group_map: dict[str, int] mapping output keys to capture groups
    """
    results: list[dict] = []
    for pat in patterns:
        compiled = re.compile(pat["regex"], re.MULTILINE)
        for f in iter_files(root, pat["file_glob"]):
            text = safe_read(f)
            if text is None:
                continue
            for match in compiled.finditer(text):
                entry = {"file": str(f.relative_to(root))}
                for key, group_idx in pat.get("group_map", {}).items():
                    try:
                        entry[key] = match.group(group_idx)
                    except IndexError:
                        pass
                results.append(entry)
    return results


def run_class_patterns(root: Path, patterns: list[dict]) -> list[dict]:
    """Run class+field regex patterns for models/schemas.

    Each pattern dict must have:
      - file_glob: str
      - class_regex: str
      - field_regex: str | None
    Returns list of {name, fields, file}.
    """
    results: list[dict] = []
    for pat in patterns:
        class_re = re.compile(pat["class_regex"], re.MULTILINE)
        field_re = (
            re.compile(pat["field_regex"], re.MULTILINE)
            if pat.get("field_regex")
            else None
        )
        for f in iter_files(root, pat["file_glob"]):
            text = safe_read(f)
            if text is None:
                continue
            for match in class_re.finditer(text):
                name = match.group(1)
                fields: list[str] = []
                if field_re:
                    block_end = find_block_end(text, match.end())
                    block = text[match.end():block_end]
                    fields = [m.group(1) for m in field_re.finditer(block)][:20]
                results.append({
                    "name": name,
                    "fields": fields,
                    "file": str(f.relative_to(root)),
                })
    return results
