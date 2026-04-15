"""Scoring formulas that turn raw tool metrics into 0-100 category scores.

Kept separate from the runners so weights and thresholds can be tuned
without touching subprocess logic.
"""


def _clamp(n: float, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, round(n)))


def security_score(
    *,
    critical: int = 0,
    high: int = 0,
    medium: int = 0,
    low: int = 0,
    secrets_found: int = 0,
) -> int:
    """Penalise by severity. Each critical ≈ 20 points off, high ≈ 10, etc.
    Secrets in git history are weighted heavily — a single leaked key is
    production-incident material.
    """
    penalty = (
        critical * 20
        + high * 10
        + medium * 3
        + low * 1
        + secrets_found * 15
    )
    return _clamp(100 - penalty)


def dependency_score(*, outdated_major: int = 0, vulnerable: int = 0) -> int:
    """Outdated major versions are soft-flagged, known CVEs hit hard."""
    penalty = outdated_major * 3 + vulnerable * 10
    return _clamp(100 - penalty)


def code_quality_score(
    *,
    complexity_ok_pct: float = 0.0,
    duplication_pct: float = 0.0,
    linter_errors: int = 0,
    loc: int = 0,
    test_files: int = 0,
    source_files: int = 0,
) -> int:
    """Weighted blend of four independent signals.

    complexity_ok_pct : % of functions under cyclomatic complexity 15 (0-100)
    duplication_pct   : % of duplicated blocks (jscpd output)
    linter_errors     : raw count of linter errors — normalised per 1000 LOC
    test_files/source_files : ratio. Capped at 0.5 (1 test per 2 source files).
    """
    complexity_component = _clamp(complexity_ok_pct)
    duplication_component = _clamp(100 - duplication_pct)
    density = (linter_errors / max(loc, 1)) * 1000
    linter_component = _clamp(100 - density)
    ratio = test_files / max(source_files, 1)
    test_component = _clamp(min(ratio, 0.5) * 200)

    return _clamp(
        complexity_component * 0.35
        + duplication_component * 0.25
        + linter_component * 0.25
        + test_component * 0.15
    )


def hygiene_score(checks: dict[str, bool]) -> int:
    """Simple checklist percentage."""
    total = len(checks)
    if total == 0:
        return 0
    passed = sum(1 for v in checks.values() if v)
    return _clamp((passed / total) * 100)


def finding(
    severity: str,
    title: str,
    tool: str,
    *,
    file: str | None = None,
    line: int | None = None,
    category: str | None = None,
) -> dict:
    """Normalised finding shape used across all runners."""
    out: dict = {"severity": severity, "title": title, "tool": tool}
    if file:
        out["file"] = file
    if line is not None:
        out["line"] = line
    if category:
        out["category"] = category
    return out
