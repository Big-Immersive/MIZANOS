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


def _dockerfile_is_applicable(repo: Path) -> bool:
    """Dockerfile is N/A for projects deployed via a platform that
    abstracts it away (Vercel/Netlify for Next.js, Expo for React Native).
    Detect those markers and treat the Dockerfile check as optional.
    """
    not_applicable_markers = [
        repo / "vercel.json",
        repo / "netlify.toml",
        repo / "expo.json",
        repo / "app.json",
    ]
    for m in not_applicable_markers:
        if m.exists():
            return False
    # Next.js repos without any infra/Docker directory usually deploy via Vercel
    has_next = any(
        (repo / f"next.config.{ext}").exists()
        for ext in ("js", "mjs", "cjs", "ts")
    )
    if has_next:
        infra_hints = [repo / "infra", repo / "docker", repo / "deploy"]
        if not any(p.is_dir() for p in infra_hints):
            return False
    return True


def _contributors_check_is_applicable(repo: Path, commits_30d: int) -> bool:
    """Solo-dev repos shouldn't be penalised for having one contributor.
    Skip this check when the project looks like it's still in early
    solo development (fewer than 30 commits in the last 30 days AND
    a small git history overall is handled elsewhere).
    """
    # For now always applicable — the low weight (5) already makes this
    # gentle for solo devs. Hook kept for future refinement.
    return True


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


async def _is_shallow_clone(repo: Path) -> bool:
    """A shallow clone has .git/shallow present."""
    return (repo / ".git" / "shallow").exists()


async def _unshallow(repo: Path) -> bool:
    """Try to fetch full history on a shallow clone. Returns True on success."""
    proc = await asyncio.create_subprocess_exec(
        "git", "-C", str(repo), "fetch", "--unshallow",
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.communicate()
    return proc.returncode == 0 and not (repo / ".git" / "shallow").exists()


async def _contributor_count(repo: Path) -> int | None:
    """Return the number of unique commit authors.

    On a shallow clone `git shortlog --all` only sees the tip commit's
    author, so it always reports 1 — a false positive for multi-person
    repos. We try to un-shallow first; if that fails (network, timeout)
    we return None so the hygiene score treats the check as N/A rather
    than counting it as 'only one contributor'.
    """
    if await _is_shallow_clone(repo):
        success = await _unshallow(repo)
        if not success:
            logger.info("hygiene: could not un-shallow repo, skipping contributor check")
            return None

    proc = await asyncio.create_subprocess_exec(
        "git", "-C", str(repo), "log", "--all", "--no-merges",
        "--pretty=format:%ae",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        return None
    authors = {ln.strip().lower() for ln in stdout.decode().splitlines() if ln.strip()}
    return len(authors)


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
        commits_30d, contributors = 0, None

    dockerfile_applicable = _dockerfile_is_applicable(repo)

    # contributors is None when the shallow clone could not be un-shallowed;
    # treat that as N/A so the check doesn't produce a false-positive
    # "only one contributor" finding.
    contributor_check: bool | None
    if contributors is None:
        contributor_check = None
    else:
        contributor_check = contributors > 1

    checks: dict[str, bool | None] = {
        "readme": _has_nontrivial_readme(repo),
        "license": _has_license(repo),
        "ci_config": _has_ci_config(repo),
        "tests_dir": _has_tests_dir(repo),
        "dockerfile": _has_dockerfile(repo) if dockerfile_applicable else None,
        "gitignore": _has_nontrivial_gitignore(repo),
        "recent_commits": commits_30d > 0,
        "contributors": contributor_check,
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
        if passed is False:
            findings.append(
                finding("low", failure_map[key], tool="hygiene", category="hygiene")
            )

    return {
        "score": hygiene_score(checks),
        "findings": findings,
        "raw_metrics": {
            "checks": {k: (v if v is not None else "n/a") for k, v in checks.items()},
            "dockerfile_applicable": dockerfile_applicable,
            "contributor_count": contributors,  # None means "N/A — shallow clone"
            "commits_last_30_days": commits_30d,
            "tools_run": ["hygiene"],
        },
    }
