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
    """Penalise secrets + SAST findings by severity.

    Dependency CVEs are deliberately NOT counted here anymore — they
    drive Dependency Health alone so we don't double-ding the same
    finding in two categories. Keep feeding only gitleaks (secrets) and
    bandit (SAST) severity counts into this scorer.

    Weights match CVSS intent: each critical is serious, a leaked secret
    is production-incident material. Low-severity SAST findings are
    soft-weighted so they never dominate the score by themselves.
    Floors at 40 so a repo with many minor findings but no catastrophes
    still shows a readable bar.
    """
    penalty = (
        critical * 8
        + high * 3
        + medium * 1
        + low * 0.3
        + secrets_found * 15
    )
    return _clamp(100 - penalty, lo=40)


def dependency_score(
    *,
    outdated_major: int = 0,
    vulnerable: int = 0,
    critical: int = 0,
    high: int = 0,
    medium: int = 0,
    low: int = 0,
) -> int:
    """Penalise by CVE severity with a softened curve so mature JS repos
    with real-but-transitive CVEs don't floor to 0.

    Accepts either a pre-summed `vulnerable` count (back-compat) or
    severity-split counts. When severity counts are provided, they take
    precedence and produce a proportional penalty that floors at 30 so
    the bar is always visible and readable.
    """
    if critical or high or medium or low:
        penalty = critical * 8 + high * 3 + medium * 1 + low * 0.3 + outdated_major * 2
        return _clamp(100 - penalty, lo=30)
    # Legacy flat-count path: cap the hit so one noisy osv run doesn't zero the score.
    penalty = outdated_major * 2 + min(vulnerable * 2, 60)
    return _clamp(100 - penalty, lo=30)


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


# Weighted hygiene items. Heavy-weight items = real project health
# signals (docs, CI, tests, recent activity). Light-weight items are
# nice-to-have but commonly absent from private/internal repos
# (LICENSE, Dockerfile, multiple contributors) and shouldn't dominate
# the score when missing.
HYGIENE_WEIGHTS: dict[str, int] = {
    "readme": 20,
    "ci_config": 20,
    "tests_dir": 18,
    "gitignore": 12,
    "recent_commits": 12,
    "license": 8,
    "dockerfile": 5,
    "contributors": 5,
}


def hygiene_score(checks: dict[str, bool | None]) -> int:
    """Weighted hygiene score.

    Each check key maps to a weight; total possible = sum of weights
    for *applicable* checks. A value of None means "not applicable"
    (e.g. no Dockerfile on a Vercel-deployed Next.js repo) and the
    check is excluded from both numerator and denominator so the repo
    isn't penalised for a non-requirement. Floors at 40 so a mostly
    bare repo still shows a readable bar.
    """
    earned = 0
    possible = 0
    for key, passed in checks.items():
        weight = HYGIENE_WEIGHTS.get(key, 10)
        if passed is None:
            continue  # check skipped as N/A
        possible += weight
        if passed:
            earned += weight
    if possible == 0:
        return 0
    return _clamp((earned / possible) * 100, lo=40)


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
