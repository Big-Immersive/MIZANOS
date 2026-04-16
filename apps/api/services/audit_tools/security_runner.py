"""Security runner — gitleaks + osv-scanner + Bandit.

All three tools run via asyncio subprocess on the cloned repo directory.
Each tool is wrapped in try/except so a single failure never aborts the scan.
"""

import asyncio
import json
import logging
import shutil
from pathlib import Path

from apps.api.services.audit_tools.scoring import finding, security_score

logger = logging.getLogger(__name__)

# Max bytes of stdout we'll accept from any one tool, to keep memory sane
_MAX_OUTPUT = 20 * 1024 * 1024  # 20 MB


async def _run(cmd: list[str], cwd: str | None = None) -> tuple[int, bytes, bytes]:
    """Run a subprocess and capture stdout/stderr with a hard cap."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return 124, b"", b"timeout"
    return proc.returncode or 0, stdout[:_MAX_OUTPUT], stderr[:_MAX_OUTPUT]


def _severity_from_cvss(score: float) -> str:
    if score >= 9.0:
        return "critical"
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    return "low"


async def _run_gitleaks(repo: Path) -> dict:
    """Detect secrets in git history. Returns {count, findings}."""
    if not shutil.which("gitleaks"):
        return {"available": False, "count": 0, "findings": []}
    rc, stdout, _ = await _run(
        ["gitleaks", "detect", "--source", str(repo), "--report-format", "json", "--no-banner", "--exit-code", "0"],
        cwd=str(repo),
    )
    findings: list[dict] = []
    if rc == 0 and stdout:
        try:
            data = json.loads(stdout.decode(errors="ignore") or "[]")
        except json.JSONDecodeError:
            data = []
        for item in data or []:
            if not isinstance(item, dict):
                continue
            findings.append(
                finding(
                    "high",
                    f"Secret detected: {item.get('RuleID') or 'unknown rule'}",
                    tool="gitleaks",
                    file=item.get("File"),
                    line=item.get("StartLine"),
                    category="security",
                )
            )
    return {"available": True, "count": len(findings), "findings": findings}


async def _run_osv_scanner(repo: Path) -> dict:
    """CVE lookup across all manifest files in the repo."""
    if not shutil.which("osv-scanner"):
        return {"available": False, "critical": 0, "high": 0, "medium": 0, "low": 0, "findings": []}
    rc, stdout, _ = await _run(
        ["osv-scanner", "--format", "json", "--recursive", str(repo)],
        cwd=str(repo),
    )
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    findings: list[dict] = []
    if stdout:
        try:
            data = json.loads(stdout.decode(errors="ignore") or "{}")
        except json.JSONDecodeError:
            data = {}
        for result in (data.get("results") or []):
            for pkg in (result.get("packages") or []):
                pkg_name = (pkg.get("package") or {}).get("name") or "unknown"
                for vuln in (pkg.get("vulnerabilities") or []):
                    cvss = 0.0
                    for sev in (vuln.get("severity") or []):
                        try:
                            cvss = max(cvss, float(sev.get("score") or 0))
                        except (TypeError, ValueError):
                            pass
                    sev_name = _severity_from_cvss(cvss)
                    counts[sev_name] += 1
                    findings.append(
                        finding(
                            sev_name,
                            f"{pkg_name}: {vuln.get('id') or 'unknown CVE'}",
                            tool="osv-scanner",
                            category="security",
                        )
                    )
    return {"available": True, **counts, "findings": findings}


async def _run_bandit(repo: Path) -> dict:
    """Python SAST — ignores repos with no .py files."""
    if not shutil.which("bandit"):
        return {"available": False, "critical": 0, "high": 0, "medium": 0, "low": 0, "findings": []}
    if not any(repo.rglob("*.py")):
        return {"available": True, "critical": 0, "high": 0, "medium": 0, "low": 0, "findings": []}
    rc, stdout, _ = await _run(
        ["bandit", "-r", str(repo), "-f", "json", "--skip", "B101", "-q"],
        cwd=str(repo),
    )
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    findings: list[dict] = []
    if stdout:
        try:
            data = json.loads(stdout.decode(errors="ignore") or "{}")
        except json.JSONDecodeError:
            data = {}
        for item in (data.get("results") or []):
            sev = (item.get("issue_severity") or "LOW").lower()
            sev_name = {"high": "high", "medium": "medium", "low": "low"}.get(sev, "low")
            counts[sev_name] += 1
            findings.append(
                finding(
                    sev_name,
                    item.get("issue_text") or item.get("test_name") or "Bandit finding",
                    tool="bandit",
                    file=item.get("filename"),
                    line=item.get("line_number"),
                    category="security",
                )
            )
    return {"available": True, **counts, "findings": findings}


async def run_security(repo_path: str) -> dict:
    """Run all three security tools concurrently and aggregate results."""
    repo = Path(repo_path)
    if not repo.is_dir():
        return {"score": 0, "findings": [], "raw_metrics": {"error": "repo path missing"}}

    results = await asyncio.gather(
        _run_gitleaks(repo),
        _run_osv_scanner(repo),
        _run_bandit(repo),
        return_exceptions=True,
    )

    gitleaks, osv, bandit = (r if not isinstance(r, Exception) else {"available": False} for r in results)
    for r, name in zip(results, ["gitleaks", "osv-scanner", "bandit"]):
        if isinstance(r, Exception):
            logger.warning("%s failed: %s", name, r)

    all_findings: list[dict] = []
    all_findings.extend(gitleaks.get("findings", []))
    all_findings.extend(bandit.get("findings", []))
    # osv-scanner CVEs are intentionally NOT aggregated into the
    # security score — they already drive Dependency Health. Keeping
    # them on both scores would double-count the same finding. We still
    # surface them in the combined findings list for visibility.
    all_findings.extend(osv.get("findings", []))

    score_totals = {
        "critical": bandit.get("critical", 0),
        "high": bandit.get("high", 0),
        "medium": bandit.get("medium", 0),
        "low": bandit.get("low", 0),
        "secrets_found": gitleaks.get("count", 0),
    }

    tools_run = [
        name
        for name, res in (("gitleaks", gitleaks), ("osv-scanner", osv), ("bandit", bandit))
        if res.get("available")
    ]

    # raw_metrics includes both the score-driving counts and the
    # osv-scanner counts (for transparency in the audit JSONB) even
    # though osv no longer drives the score.
    raw_metrics = {
        **score_totals,
        "dep_cves_surfaced": {
            "critical": osv.get("critical", 0),
            "high": osv.get("high", 0),
            "medium": osv.get("medium", 0),
            "low": osv.get("low", 0),
        },
        "tools_run": tools_run,
    }

    return {
        "score": security_score(**score_totals),
        "findings": all_findings,
        "raw_metrics": raw_metrics,
    }
