"""Dependency Health runner — osv-scanner (manifest-based, no install needed).

We deliberately do NOT run `pip list --outdated` or `npm outdated`:
  - pip inspects the worker container's Python env, not the target repo.
  - npm outdated needs `npm install` first; on a raw clone it produces
    noisy "major behind" counts that pushed scores to 0 regardless of
    the repo's real health.

osv-scanner reads pyproject.toml / requirements.txt / package.json /
package-lock.json / poetry.lock directly and reports real CVEs. That's
the honest signal — a dep is "bad" if it has a known vulnerability,
not if a newer major exists on the registry.
"""

import logging
import re
from pathlib import Path

from apps.api.services.audit_tools.scoring import dependency_score, finding
from apps.api.services.audit_tools.security_runner import _run_osv_scanner

logger = logging.getLogger(__name__)

_WILDCARD_RE = re.compile(r'["\'][~^*]|"\*"|\blatest\b', re.IGNORECASE)


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

    try:
        osv = await _run_osv_scanner(repo)
    except Exception as exc:
        logger.warning("osv-scanner failed: %s", exc)
        osv = {"available": False, "critical": 0, "high": 0, "medium": 0, "low": 0, "findings": []}

    critical = osv.get("critical", 0)
    high = osv.get("high", 0)
    medium = osv.get("medium", 0)
    low = osv.get("low", 0)
    vulnerable = critical + high + medium + low
    unpinned = _count_unpinned(repo)

    findings: list[dict] = list(osv.get("findings", []))
    if unpinned > 10:
        findings.append(
            finding(
                "low",
                f"{unpinned} dependencies use unpinned version specifiers",
                tool="manifest-regex",
                category="dependencies",
            )
        )

    tools_run = ["osv-scanner"] if osv.get("available") else []
    score = dependency_score(
        critical=critical, high=high, medium=medium, low=low, outdated_major=0,
    )
    logger.warning(
        "AUDIT_DEP score=%s vulnerable=%s c=%s h=%s m=%s l=%s unpinned=%s tools=%s",
        score, vulnerable, critical, high, medium, low, unpinned, tools_run,
    )

    return {
        "score": score,
        "findings": findings,
        "raw_metrics": {
            "outdated_major": 0,
            "vulnerable": vulnerable,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "unpinned_specifiers": unpinned,
            "tools_run": tools_run,
        },
    }
