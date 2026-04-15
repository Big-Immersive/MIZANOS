"""Code Quality runner — lizard + jscpd + Ruff + test/source file count.

Uses lizard for multi-language complexity (works on JS/TS/Python/Go/etc),
jscpd for cross-file duplication, Ruff for Python linting, and plain
file-count regex for test-to-source ratio.
"""

import asyncio
import json
import logging
import shutil
from pathlib import Path

from apps.api.services.audit_tools.scoring import code_quality_score, finding
from apps.api.services.audit_tools.security_runner import _run

logger = logging.getLogger(__name__)

_SOURCE_EXTS = {".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".rb", ".rs", ".cpp", ".c", ".cs", ".swift", ".kt", ".php"}
_TEST_PATTERNS = ("*.test.*", "*.spec.*")
_TEST_DIRS = {"tests", "test", "__tests__", "spec"}


def _walk_sources(repo: Path) -> tuple[int, int, int]:
    """Return (source_files, test_files, total_loc)."""
    source_files = 0
    test_files = 0
    total_loc = 0
    for p in repo.rglob("*"):
        if not p.is_file() or p.suffix not in _SOURCE_EXTS:
            continue
        # skip vendored / dep folders
        parts = set(p.parts)
        if "node_modules" in parts or "venv" in parts or ".venv" in parts or "dist" in parts or "build" in parts:
            continue
        is_test = (
            any(parent.name in _TEST_DIRS for parent in p.parents)
            or ".test." in p.name
            or ".spec." in p.name
        )
        if is_test:
            test_files += 1
        else:
            source_files += 1
        try:
            total_loc += sum(1 for _ in p.open("rb"))
        except OSError:
            continue
    return source_files, test_files, total_loc


def _run_lizard_sync(repo: Path) -> tuple[float, int, list[dict]]:
    """Return (complexity_ok_pct, total_funcs, findings).

    Uses lizard as a Python library rather than CLI. Lizard doesn't emit
    JSON — its flags are text/XML/CSV — so we import it directly.
    """
    try:
        import lizard  # type: ignore
    except ImportError:
        return 0.0, 0, []

    total = 0
    ok = 0
    hotspots: list[dict] = []
    try:
        for file_info in lizard.analyze([str(repo)]):
            for func in file_info.function_list:
                ccn = getattr(func, "cyclomatic_complexity", 0)
                total += 1
                if ccn <= 15:
                    ok += 1
                else:
                    hotspots.append(
                        finding(
                            "medium" if ccn < 25 else "high",
                            f"{func.name} — complexity {ccn}",
                            tool="lizard",
                            file=file_info.filename,
                            line=getattr(func, "start_line", None),
                            category="code_quality",
                        )
                    )
    except Exception as exc:
        logger.warning("lizard analyze failed: %s", exc)
        return 0.0, 0, []

    if total == 0:
        return 0.0, 0, []
    pct = (ok / total) * 100
    return pct, total, hotspots[:20]


async def _run_lizard(repo: Path) -> tuple[float, int, list[dict]]:
    """Async wrapper — lizard's library API is synchronous, run it in a
    thread so we don't block the event loop."""
    return await asyncio.to_thread(_run_lizard_sync, repo)


async def _run_jscpd(repo: Path) -> tuple[float, list[dict]]:
    """Return (duplication_pct, findings)."""
    if not shutil.which("jscpd"):
        return 0.0, []
    rc, stdout, _ = await _run(
        ["jscpd", "--reporters", "json", "--silent", "--output", "/tmp/jscpd", str(repo)],
        cwd=str(repo),
    )
    report_file = Path("/tmp/jscpd/jscpd-report.json")
    if not report_file.exists():
        return 0.0, []
    try:
        data = json.loads(report_file.read_text(errors="ignore"))
    except (json.JSONDecodeError, OSError):
        return 0.0, []
    stats = (data.get("statistics") or {}).get("total") or {}
    pct = float(stats.get("percentage") or 0)
    findings: list[dict] = []
    if pct > 5:
        findings.append(
            finding(
                "medium" if pct < 15 else "high",
                f"Code duplication: {pct:.1f}% across {stats.get('clones', 0)} clone groups",
                tool="jscpd",
                category="code_quality",
            )
        )
    return pct, findings


async def _run_ruff(repo: Path) -> tuple[int, list[dict]]:
    """Return (error_count, findings). Skips if no Python files."""
    if not shutil.which("ruff") or not any(repo.rglob("*.py")):
        return 0, []
    rc, stdout, _ = await _run(
        ["ruff", "check", "--output-format", "json", "--exit-zero", str(repo)],
        cwd=str(repo),
    )
    if not stdout:
        return 0, []
    try:
        items = json.loads(stdout.decode(errors="ignore") or "[]")
    except json.JSONDecodeError:
        return 0, []
    findings: list[dict] = []
    for item in items[:30]:  # cap findings
        findings.append(
            finding(
                "low",
                f"{item.get('code', 'ruff')}: {item.get('message', '')}",
                tool="ruff",
                file=item.get("filename"),
                line=(item.get("location") or {}).get("row"),
                category="code_quality",
            )
        )
    return len(items), findings


async def run_code_quality(repo_path: str) -> dict:
    """Measure objective code health."""
    repo = Path(repo_path)
    if not repo.is_dir():
        return {"score": 0, "findings": [], "raw_metrics": {"error": "repo path missing"}}

    # File counts are synchronous but fast
    source_files, test_files, loc = _walk_sources(repo)

    results = await asyncio.gather(
        _run_lizard(repo),
        _run_jscpd(repo),
        _run_ruff(repo),
        return_exceptions=True,
    )
    lizard_res, jscpd_res, ruff_res = results
    for r, name in zip(results, ["lizard", "jscpd", "ruff"]):
        if isinstance(r, Exception):
            logger.warning("code_quality %s failed: %s", name, r)

    complexity_ok_pct, total_funcs, complexity_findings = (
        lizard_res if isinstance(lizard_res, tuple) else (0.0, 0, [])
    )
    duplication_pct, dup_findings = (
        jscpd_res if isinstance(jscpd_res, tuple) else (0.0, [])
    )
    linter_errors, ruff_findings = (
        ruff_res if isinstance(ruff_res, tuple) else (0, [])
    )

    all_findings: list[dict] = []
    all_findings.extend(complexity_findings)
    all_findings.extend(dup_findings)
    all_findings.extend(ruff_findings)

    tools_run: list[str] = []
    if total_funcs:
        tools_run.append("lizard")
    if duplication_pct or dup_findings:
        tools_run.append("jscpd")
    if linter_errors or ruff_findings:
        tools_run.append("ruff")
    tools_run.append("file-count")

    return {
        "score": code_quality_score(
            complexity_ok_pct=complexity_ok_pct,
            duplication_pct=duplication_pct,
            linter_errors=linter_errors,
            loc=loc,
            test_files=test_files,
            source_files=source_files,
        ),
        "findings": all_findings,
        "raw_metrics": {
            "source_files": source_files,
            "test_files": test_files,
            "total_loc": loc,
            "total_functions": total_funcs,
            "complexity_ok_pct": round(complexity_ok_pct, 1),
            "duplication_pct": round(duplication_pct, 1),
            "linter_errors": linter_errors,
            "tools_run": tools_run,
        },
    }
