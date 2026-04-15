"""Project Hygiene runner — pure Python, no external tools.

Checks the cloned repo for the presence of "every well-run project has this"
artefacts: README, LICENSE, CI config, tests directory, Dockerfile, non-trivial
.gitignore, recent commit activity, and more than one contributor.
"""

import asyncio
import logging
import os
from pathlib import Path

from apps.api.services.audit_tools.scoring import finding, hygiene_score

logger = logging.getLogger(__name__)


def _has_nontrivial_readme(repo: Path) -> bool:
    for name in ("README.md", "README.rst", "README.txt", "README"):
        path = repo / name
        if path.exists() and path.is_file():
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                return False
            return len(text.split()) >= 50
    return False


def _has_license(repo: Path) -> bool:
    for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"):
        if (repo / name).exists():
            return True
    return False


def _has_ci_config(repo: Path) -> bool:
    candidates = [
        repo / ".github" / "workflows",
        repo / ".gitlab-ci.yml",
        repo / ".circleci" / "config.yml",
        repo / "azure-pipelines.yml",
        repo / "bitbucket-pipelines.yml",
        repo / ".drone.yml",
    ]
    for c in candidates:
        if c.exists():
            if c.is_dir():
                try:
                    if any(p.suffix in (".yml", ".yaml") for p in c.iterdir()):
                        return True
                except OSError:
                    continue
            else:
                return True
    return False


def _has_tests_dir(repo: Path) -> bool:
    for name in ("tests", "test", "__tests__", "spec"):
        if (repo / name).is_dir():
            return True
    # also accept any *.test.* / *.spec.* file at any depth
    for pattern in ("*.test.*", "*.spec.*"):
        if any(repo.rglob(pattern)):
            return True
    return False


def _has_dockerfile(repo: Path) -> bool:
    for name in ("Dockerfile", "docker-compose.yml", "docker-compose.yaml"):
        if (repo / name).exists():
            return True
    # scan one level down for monorepos (infra/, docker/, apps/*/)
    for sub in ("infra", "docker", "deploy"):
        p = repo / sub
        if p.is_dir() and any(
            (p / n).exists() for n in ("Dockerfile", "docker-compose.yml")
        ):
            return True
    return False


def _has_nontrivial_gitignore(repo: Path) -> bool:
    path = repo / ".gitignore"
    if not path.exists():
        return False
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return False
    lines = [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.startswith("#")]
    return len(lines) >= 3


async def _recent_commits(repo: Path) -> int:
    proc = await asyncio.create_subprocess_exec(
        "git", "-C", str(repo), "log", "--since=30 days ago", "--oneline",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        return 0
    return len([ln for ln in stdout.decode().splitlines() if ln.strip()])


async def _contributor_count(repo: Path) -> int:
    proc = await asyncio.create_subprocess_exec(
        "git", "-C", str(repo), "shortlog", "-sn", "--all", "--no-merges",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        return 0
    return len([ln for ln in stdout.decode().splitlines() if ln.strip()])


async def check_hygiene(repo_path: str) -> dict:
    """Return the hygiene audit result."""
    repo = Path(repo_path)
    if not repo.is_dir():
        return {"score": 0, "findings": [], "raw_metrics": {"error": "repo path missing"}}

    try:
        commits_30d, contributors = await asyncio.gather(
            _recent_commits(repo),
            _contributor_count(repo),
        )
    except Exception as exc:
        logger.warning("hygiene git stats failed: %s", exc)
        commits_30d, contributors = 0, 0

    checks = {
        "readme": _has_nontrivial_readme(repo),
        "license": _has_license(repo),
        "ci_config": _has_ci_config(repo),
        "tests_dir": _has_tests_dir(repo),
        "dockerfile": _has_dockerfile(repo),
        "gitignore": _has_nontrivial_gitignore(repo),
        "recent_commits": commits_30d > 0,
        "contributors": contributors > 1,
    }

    findings: list[dict] = []
    failure_map = {
        "readme": "README is missing or has fewer than 50 words",
        "license": "LICENSE file is missing",
        "ci_config": "No CI configuration found (GitHub Actions / GitLab CI / CircleCI)",
        "tests_dir": "No tests directory or *.test.* / *.spec.* files found",
        "dockerfile": "No Dockerfile or docker-compose file found",
        "gitignore": ".gitignore is missing or trivially small",
        "recent_commits": "No commits in the last 30 days",
        "contributors": "Only one contributor on record",
    }
    for key, passed in checks.items():
        if not passed:
            findings.append(
                finding("low", failure_map[key], tool="hygiene", category="hygiene")
            )

    return {
        "score": hygiene_score(checks),
        "findings": findings,
        "raw_metrics": {
            "checks": checks,
            "commits_last_30_days": commits_30d,
            "contributor_count": contributors,
            "tools_run": ["hygiene"],
        },
    }
