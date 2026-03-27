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
    """Expand brace syntax into multiple globs."""
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


def extract_docstring(block: str) -> str:
    """Extract first docstring or comment from a code block (max 200 chars)."""
    # Python triple-quote docstring
    m = re.search(r'"""(.*?)"""', block, re.DOTALL)
    if m:
        return m.group(1).strip()[:200]
    m = re.search(r"'''(.*?)'''", block, re.DOTALL)
    if m:
        return m.group(1).strip()[:200]
    # JS/TS /** */ comment
    m = re.search(r"/\*\*(.*?)\*/", block, re.DOTALL)
    if m:
        return re.sub(r"\s*\*\s*", " ", m.group(1)).strip()[:200]
    # Single-line comments at start
    lines = block.strip().split("\n")[:3]
    comments = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith("//"):
            comments.append(stripped.lstrip("#/ "))
        else:
            break
    return " ".join(comments)[:200] if comments else ""


def extract_method_names(block: str) -> list[str]:
    """Extract method/function names defined in a block (max 10)."""
    methods = re.findall(r"(?:async\s+)?(?:def|function)\s+(\w+)", block)
    return methods[:10]


def extract_field_with_types(block: str, field_re, type_re=None) -> list[str]:
    """Extract fields with type annotations if available."""
    if type_re:
        compiled = re.compile(type_re, re.MULTILINE)
        matches = compiled.findall(block)
        return [f"{name}: {typ}" for name, typ in matches][:20]
    if field_re:
        compiled = re.compile(field_re, re.MULTILINE) if isinstance(field_re, str) else field_re
        return [m.group(1) for m in compiled.finditer(block)][:20]
    return []


def run_regex_patterns(root: Path, patterns: list[dict]) -> list[dict]:
    """Run regex-based patterns against matching files."""
    results: list[dict] = []
    for pat in patterns:
        compiled = re.compile(pat["regex"], re.MULTILINE)
        handler_re = re.compile(pat["handler_lookahead"], re.MULTILINE) if pat.get("handler_lookahead") else None
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
                # Look ahead for handler name
                if handler_re:
                    after = text[match.end():match.end() + 300]
                    hm = handler_re.search(after)
                    if hm:
                        entry["handler"] = hm.group(1)
                results.append(entry)
    return results


def run_class_patterns(root: Path, patterns: list[dict]) -> list[dict]:
    """Run class+field regex patterns for models/schemas with enriched data."""
    results: list[dict] = []
    for pat in patterns:
        class_re = re.compile(pat["class_regex"], re.MULTILINE)
        field_re = (
            re.compile(pat["field_regex"], re.MULTILINE)
            if pat.get("field_regex")
            else None
        )
        type_re = pat.get("field_type_regex")
        for f in iter_files(root, pat["file_glob"]):
            text = safe_read(f)
            if text is None:
                continue
            for match in class_re.finditer(text):
                name = match.group(1)
                block_end = find_block_end(text, match.end())
                block = text[match.end():block_end]

                fields: list[str] = []
                if field_re:
                    fields = [m.group(1) for m in field_re.finditer(block)][:20]

                field_types = extract_field_with_types(block, field_re, type_re)
                docstring = extract_docstring(block)
                methods = extract_method_names(block)

                results.append({
                    "name": name,
                    "fields": fields,
                    "field_types": field_types,
                    "docstring": docstring,
                    "methods": methods,
                    "file": str(f.relative_to(root)),
                })
    return results
