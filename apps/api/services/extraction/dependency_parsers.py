"""Dependency file detection and parsing for all major ecosystems."""

import json
import re
from pathlib import Path


_SKIP_DIRS = {"node_modules", ".git", ".venv", "venv", "dist", "build", ".next", ".nuxt"}


def parse_all_dependencies(root: Path) -> dict[str, dict]:
    """Parse all recognized dependency files under root (including nested)."""
    deps: dict[str, dict] = {}
    for entry in _SOURCES:
        for filepath in root.rglob(entry["filename"]):
            if any(part in _SKIP_DIRS for part in filepath.parts):
                continue
            try:
                parsed = entry["parser"](filepath)
            except (OSError, json.JSONDecodeError, ValueError):
                continue
            if parsed:
                deps.setdefault(entry["ecosystem"], {}).update(parsed)
    return deps


# --- Individual parsers (each <15 LOC) ---


def _parse_package_json(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text())
    return {**data.get("dependencies", {}), **data.get("devDependencies", {})}


def _parse_pyproject(path: Path) -> dict[str, str]:
    text = path.read_text()
    deps: dict[str, str] = {}
    in_deps = False
    for line in text.splitlines():
        if line.strip().startswith("[") and "dependencies" in line:
            in_deps = True
            continue
        if in_deps and line.strip().startswith("["):
            break
        if in_deps and re.search(r"[=<>]", line):
            pkg = re.split(r"[=<>!~\s]", line.strip().strip('"').strip("'"))[0]
            if pkg and not pkg.startswith("["):
                deps[pkg] = ""
    return deps


def _parse_requirements_txt(path: Path) -> dict[str, str]:
    deps: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        pkg = re.split(r"[=<>!~;]", line)[0].strip()
        if pkg:
            deps[pkg] = ""
    return deps


def _parse_cargo_toml(path: Path) -> dict[str, str]:
    text = path.read_text()
    deps: dict[str, str] = {}
    in_deps = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "[dependencies]" or stripped == "[dev-dependencies]":
            in_deps = True
            continue
        if in_deps and stripped.startswith("["):
            in_deps = False
            continue
        if in_deps and "=" in line:
            pkg = line.split("=")[0].strip()
            if pkg:
                deps[pkg] = ""
    return deps


def _parse_go_mod(path: Path) -> dict[str, str]:
    text = path.read_text()
    deps: dict[str, str] = {}
    in_require = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("require ("):
            in_require = True
            continue
        if in_require and stripped == ")":
            in_require = False
            continue
        if in_require and stripped:
            parts = stripped.split()
            if parts:
                deps[parts[0]] = parts[1] if len(parts) > 1 else ""
        elif stripped.startswith("require ") and "(" not in stripped:
            parts = stripped.replace("require ", "").split()
            if parts:
                deps[parts[0]] = parts[1] if len(parts) > 1 else ""
    return deps


def _parse_gemfile(path: Path) -> dict[str, str]:
    deps: dict[str, str] = {}
    for line in path.read_text().splitlines():
        match = re.match(r"""^\s*gem\s+['"](\S+?)['"]""", line)
        if match:
            deps[match.group(1)] = ""
    return deps


def _parse_composer_json(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text())
    return {**data.get("require", {}), **data.get("require-dev", {})}


def _parse_pom_xml(path: Path) -> dict[str, str]:
    text = path.read_text()
    deps: dict[str, str] = {}
    for match in re.finditer(
        r"<dependency>\s*<groupId>([^<]+)</groupId>\s*<artifactId>([^<]+)</artifactId>",
        text, re.DOTALL,
    ):
        deps[f"{match.group(1)}:{match.group(2)}"] = ""
    return deps


def _parse_build_gradle(path: Path) -> dict[str, str]:
    deps: dict[str, str] = {}
    for match in re.finditer(
        r"""(?:implementation|api|compile)\s+['"]([^'"]+)['"]""",
        path.read_text(),
    ):
        deps[match.group(1)] = ""
    return deps


# --- Source registry ---

_SOURCES: list[dict] = [
    {"filename": "package.json", "ecosystem": "npm", "parser": _parse_package_json},
    {"filename": "pyproject.toml", "ecosystem": "pip", "parser": _parse_pyproject},
    {"filename": "requirements.txt", "ecosystem": "pip", "parser": _parse_requirements_txt},
    {"filename": "Cargo.toml", "ecosystem": "cargo", "parser": _parse_cargo_toml},
    {"filename": "go.mod", "ecosystem": "go", "parser": _parse_go_mod},
    {"filename": "Gemfile", "ecosystem": "ruby", "parser": _parse_gemfile},
    {"filename": "composer.json", "ecosystem": "php", "parser": _parse_composer_json},
    {"filename": "pom.xml", "ecosystem": "java", "parser": _parse_pom_xml},
    {"filename": "build.gradle", "ecosystem": "java", "parser": _parse_build_gradle},
]
