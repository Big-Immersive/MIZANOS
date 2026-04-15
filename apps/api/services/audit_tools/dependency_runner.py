"""Dependency Health runner — npm outdated + osv-scanner (repo manifests).

Python dependency health is covered via osv-scanner (reads pyproject.toml /
requirements.txt / poetry.lock etc directly). We deliberately do NOT run
`pip list --outdated`, because that inspects the worker container's Python
env — not the target repo's declared dependencies — and would produce
misleading "outdated" counts.
"""

import asyncio
import json
import logging
import re
import shutil
from pathlib import Path

from apps.api.services.audit_tools.scoring import dependency_score, finding
from apps.api.services.audit_tools.security_runner import _run, _run_osv_scanner

logger = logging.getLogger(__name__)

_WILDCARD_RE = re.compile(r'["\'][~^*]|"\*"|\blatest\b', re.IGNORECASE)


async def _npm_outdated(repo: Path) -> tuple[int, list[dict]]:
    """Return (outdated_major_count, findings) if package.json exists."""
    if not (repo / "package.json").exists():
        return 0, []
    if not shutil.which("npm"):
        return 0, []
    rc, stdout, _ = await _run(["npm", "outdated", "--json"], cwd=str(repo))
    # npm outdated returns 1 when outdated packages exist — still valid JSON
    if not stdout:
        return 0, []
    try:
        items = json.loads(stdout.decode(errors="ignore") or "{}")
    except json.JSONDecodeError:
        return 0, []
    outdated_major = 0
    findings: list[dict] = []
    for name, info in (items or {}).items():
        if not isinstance(info, dict):
            continue
        try:
            cur = (info.get("current") or "0").split(".")[0]
            latest = (info.get("latest") or "0").split(".")[0]
            if cur and latest and int(cur) < int(latest):
                outdated_major += 1
                findings.append(
                    finding(
                        "medium",
                        f"{name}: {info.get('current')} → {info.get('latest')} (major)",
                        tool="npm",
                        category="dependencies",
                    )
                )
        except (ValueError, AttributeError):
            continue
    return outdated_major, findings


def _count_unpinned(repo: Path) -> int:
    """Heuristic: wildcard / caret / tilde / 'latest' in manifest files."""
    manifests = [
        repo / "package.json",
        repo / "pyproject.toml",
    ]
    manifests.extend(repo.glob("requirements*.txt"))
    count = 0
    for m in manifests:
        if not m.exists():
            continue
        try:
            text = m.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        count += len(_WILDCARD_RE.findall(text))
    return count


async def run_dependencies(repo_path: str) -> dict:
    """Run dependency audits and return a unified result."""
    repo = Path(repo_path)
    if not repo.is_dir():
        return {"score": 0, "findings": [], "raw_metrics": {"error": "repo path missing"}}

    results = await asyncio.gather(
        _npm_outdated(repo),
        _run_osv_scanner(repo),
        return_exceptions=True,
    )
    npm_res, osv_res = results
    for r, name in zip(results, ["npm", "osv-scanner"]):
        if isinstance(r, Exception):
            logger.warning("dependency %s failed: %s", name, r)

    npm_outdated_major, npm_findings = npm_res if isinstance(npm_res, tuple) else (0, [])
    osv = osv_res if isinstance(osv_res, dict) else {"available": False, "critical": 0, "high": 0, "medium": 0, "low": 0, "findings": []}

    outdated_major = npm_outdated_major
    vulnerable = osv.get("critical", 0) + osv.get("high", 0) + osv.get("medium", 0) + osv.get("low", 0)
    unpinned = _count_unpinned(repo)

    findings: list[dict] = []
    findings.extend(npm_findings)
    findings.extend(osv.get("findings", []))
    if unpinned > 10:
        findings.append(
            finding(
                "low",
                f"{unpinned} dependencies use unpinned version specifiers",
                tool="manifest-regex",
                category="dependencies",
            )
        )

    tools_run = ["npm"] + (["osv-scanner"] if osv.get("available") else [])

    return {
        "score": dependency_score(outdated_major=outdated_major, vulnerable=vulnerable),
        "findings": findings,
        "raw_metrics": {
            "outdated_major": outdated_major,
            "vulnerable": vulnerable,
            "unpinned_specifiers": unpinned,
            "tools_run": tools_run,
        },
    }
