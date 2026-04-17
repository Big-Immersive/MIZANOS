"""AI-powered project report analysis with Redis caching."""

import json
import logging
from datetime import datetime, timezone
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from apps.api.models.audit import Audit
from apps.api.models.milestone import Milestone
from apps.api.models.task import Task
from apps.api.services.llm_config import get_llm_config
from apps.api.services.project_report_pdf_health import compute_dev_health
from apps.api.services.report_service import ReportService
from apps.api.services.scan_service import ScanService

logger = logging.getLogger(__name__)

CACHE_TTL = 86400  # 24 hours
CACHE_PREFIX = "report_analysis_v2"


class ReportAIService:
    """Generate and cache AI analysis for project reports."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def generate_analysis(self, product_id: UUID) -> dict:
        """Generate AI analysis for a project, caching the result."""
        report = await ReportService(self.session).get_project_report(product_id)
        scan_result = await ScanService(self.session).get_latest_scan_result(product_id)
        audit = await self._fetch_latest_audit(product_id)
        bugs = await self._fetch_bug_summary(product_id)
        milestones = await self._fetch_milestone_summary(product_id)
        dev_health = compute_dev_health(scan_result, audit, None)

        prompt = self._build_prompt(report, scan_result, audit, bugs, milestones, dev_health)
        analysis = await self._call_llm(prompt)
        analysis["generated_at"] = datetime.now(timezone.utc).isoformat()

        await self._cache_set(product_id, analysis)
        return analysis

    # ------------------------------------------------------------------
    # Extra signal fetchers (scan / audit / bugs / milestones)
    # ------------------------------------------------------------------

    async def _fetch_latest_audit(self, product_id: UUID) -> Audit | None:
        """Return the most recent audit that uses the new category schema."""
        stmt = (
            select(Audit)
            .where(Audit.product_id == product_id)
            .order_by(Audit.run_at.desc())
            .limit(10)
        )
        result = await self.session.execute(stmt)
        for row in result.scalars().all():
            cats = row.categories if isinstance(row.categories, dict) else {}
            if any(k in cats for k in ("dependencies", "code_quality", "hygiene")):
                return row
        return None

    async def _fetch_bug_summary(self, product_id: UUID) -> dict:
        stmt = select(Task).where(
            Task.product_id == product_id, Task.task_type == "bug",
        )
        result = await self.session.execute(stmt)
        rows = list(result.scalars().all())
        by_status: dict[str, int] = {}
        open_titles: list[str] = []
        closed_set = {"fixed", "verified", "live", "closed"}
        for b in rows:
            key = (b.status or "reported").lower()
            by_status[key] = by_status.get(key, 0) + 1
            if key not in closed_set and len(open_titles) < 8:
                open_titles.append(b.title)
        return {"total": len(rows), "by_status": by_status, "open_titles": open_titles}

    async def _fetch_milestone_summary(self, product_id: UUID) -> list[dict]:
        done_statuses = {"done", "live", "completed"}
        mstmt = (
            select(Milestone)
            .where(Milestone.product_id == product_id)
            .order_by(Milestone.sort_order, Milestone.created_at)
        )
        tstmt = select(Task).where(
            Task.product_id == product_id, Task.task_type == "task",
        )
        mresult = await self.session.execute(mstmt)
        tresult = await self.session.execute(tstmt)
        milestones = list(mresult.scalars().all())
        tasks = list(tresult.scalars().all())
        out: list[dict] = []
        for m in milestones:
            m_tasks = [t for t in tasks if t.milestone_id == m.id]
            total = len(m_tasks)
            done = sum(1 for t in m_tasks if (t.status or "").lower() in done_statuses)
            pct = round((done / total) * 100) if total else 0
            out.append({
                "title": m.title,
                "due_date": m.due_date.strftime("%Y-%m-%d") if m.due_date else None,
                "done": done,
                "total": total,
                "pct": pct,
            })
        return out

    async def get_cached_analysis(self, product_id: UUID) -> dict | None:
        """Return cached analysis or None."""
        return await self._cache_get(product_id)

    # ------------------------------------------------------------------
    # LLM call
    # ------------------------------------------------------------------

    async def _call_llm(self, prompt: str) -> dict:
        import openai

        config = await get_llm_config(self.session)
        client = openai.AsyncOpenAI(api_key=config.api_key, base_url=config.base_url)

        response = await client.chat.completions.create(
            model=config.model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or "{}"
        from packages.common.utils.json_utils import extract_json_text
        cleaned = extract_json_text(raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("AI returned non-JSON, wrapping as health_assessment")
            return {
                "health_assessment": cleaned or raw,
                "risk_factors": [],
                "recommendations": [],
                "dev_contribution_summary": "",
            }

    # ------------------------------------------------------------------
    # Prompt builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(
        report: dict,
        scan_result,
        audit: Audit | None,
        bugs: dict,
        milestones: list[dict],
        dev_health: dict,
    ) -> str:
        tm = report.get("task_metrics", {})
        fm = report.get("feature_metrics", {})
        gm = report.get("github_metrics") or {}
        task_details = report.get("task_details", [])

        base = (
            f"Project: {report.get('product_name', 'Unknown')}\n"
            f"Stage: {report.get('stage', 'N/A')}, Status: {report.get('status', 'N/A')}\n"
            f"PM: {report.get('pm_name', 'N/A')}, Dev: {report.get('dev_name', 'N/A')}\n\n"
            f"Tasks: {tm.get('total', 0)} total, "
            f"{tm.get('completion_pct', 0)}% complete, "
            f"{tm.get('overdue_count', 0)} overdue\n"
            f"Status breakdown: {json.dumps(tm.get('by_status', {}))}\n"
            f"Priority breakdown: {json.dumps(tm.get('by_priority', {}))}\n\n"
            f"Features: {fm.get('total', 0)} total, "
            f"{fm.get('completion_pct', 0)}% complete\n"
            f"Feature status: {json.dumps(fm.get('by_status', {}))}\n\n"
            f"GitHub: {gm.get('total_scans', 0)} scans, "
            f"+{gm.get('total_lines_added', 0)}/-{gm.get('total_lines_removed', 0)} lines\n"
        )

        return (
            base
            + _build_task_section(task_details)
            + _build_scan_section(scan_result)
            + _build_audit_section(audit)
            + _build_dev_health_section(dev_health)
            + _build_milestone_section(milestones)
            + _build_bug_section(bugs)
            + "\nAnalyze this project and respond with ONLY valid JSON."
        )

    # ------------------------------------------------------------------
    # Redis cache
    # ------------------------------------------------------------------

    async def _cache_get(self, product_id: UUID) -> dict | None:
        try:
            r = aioredis.from_url(settings.redis_url)
            data = await r.get(f"{CACHE_PREFIX}:{product_id}")
            await r.aclose()
            return json.loads(data) if data else None
        except Exception:
            logger.debug("Redis cache miss for report analysis", exc_info=True)
            return None

    async def _cache_set(self, product_id: UUID, analysis: dict) -> None:
        try:
            r = aioredis.from_url(settings.redis_url)
            await r.setex(f"{CACHE_PREFIX}:{product_id}", CACHE_TTL, json.dumps(analysis))
            await r.aclose()
        except Exception:
            logger.warning("Failed to cache report analysis", exc_info=True)


# ------------------------------------------------------------------
# Task section builder
# ------------------------------------------------------------------

_COMPLETED = {"done", "completed", "verified", "live", "fixed"}


def _build_task_section(tasks: list[dict]) -> str:
    """Build the task details section for the AI prompt."""
    if not tasks:
        return ""

    at_risk = []
    other = []
    for t in tasks:
        status = (t.get("status") or "").lower()
        if status in _COMPLETED:
            other.append(t)
        elif t.get("is_overdue") or t.get("priority") == "high" or t.get("assignee_name") == "Unassigned":
            at_risk.append(t)
        else:
            other.append(t)

    lines = ["\n\n--- TASK DETAILS ---"]

    if at_risk:
        lines.append("\nAT-RISK TASKS (require immediate attention):")
        for t in at_risk[:15]:
            due = t.get("due_date", "no due date")
            if due and due != "no due date":
                due = due[:10]
            overdue_tag = " [OVERDUE]" if t.get("is_overdue") else ""
            lines.append(
                f'- "{t["title"]}" | {t["priority"]} | {t["status"]} '
                f'| {t["assignee_name"]} | due: {due}{overdue_tag}'
            )

    if other:
        completed = [t for t in other if (t.get("status") or "").lower() in _COMPLETED]
        in_progress = [t for t in other if (t.get("status") or "").lower() not in _COMPLETED]

        summaries = []
        for t in (in_progress + completed)[:25]:
            extra = f", {t['priority']}" if t.get("priority") not in (None, "none", "medium") else ""
            assignee = f", {t['assignee_name']}" if t.get("assignee_name") != "Unassigned" else ", unassigned"
            summaries.append(f'"{t["title"]}" ({t["status"]}{extra}{assignee})')

        lines.append(f"\nOTHER TASKS ({len(other)}):")
        lines.append(", ".join(summaries))

    if not at_risk and all((t.get("status") or "").lower() in _COMPLETED for t in tasks):
        lines.append("\nAll tasks are completed.")

    return "\n".join(lines)


def _build_scan_section(scan_result) -> str:
    """Code Evidence Scan summary: verified vs partial vs no-evidence tasks."""
    if not scan_result:
        return "\n\n--- CODE EVIDENCE SCAN --- (not run yet)"
    ga = getattr(scan_result, "gap_analysis", None) or {}
    inv = getattr(scan_result, "functional_inventory", None) or []
    verified = ga.get("verified")
    partial = ga.get("partial")
    no_ev = ga.get("no_evidence")
    total = ga.get("total_tasks")
    pct = ga.get("progress_pct")
    lines = ["\n\n--- CODE EVIDENCE SCAN ---"]
    if total is not None:
        lines.append(
            f"Evidence progress: {pct}% ({verified} verified, {partial} partial, "
            f"{no_ev} no-evidence of {total} tasks)",
        )
    if isinstance(inv, list) and inv:
        gaps = [e for e in inv if isinstance(e, dict) and not (e.get("artifacts_found") or [])]
        if gaps:
            titles = [e.get("task_title") or e.get("task_id") for e in gaps[:5]]
            lines.append(f"Tasks with no code artifacts: {', '.join(t for t in titles if t)}")
    return "\n".join(lines)


def _build_audit_section(audit) -> str:
    """Security / dependencies / code-quality / hygiene scores + top findings."""
    if not audit:
        return "\n\n--- CODE AUDIT --- (no audit yet)"
    cats = audit.categories if isinstance(audit.categories, dict) else {}
    issues = audit.issues if isinstance(audit.issues, dict) else {}
    critical = issues.get("critical") or []
    warnings = issues.get("warnings") or []
    lines = [
        "\n\n--- CODE AUDIT ---",
        f"Overall: {round(audit.overall_score)}",
    ]
    cat_bits = []
    for k in ("security", "dependencies", "code_quality", "hygiene"):
        v = cats.get(k)
        if isinstance(v, (int, float)):
            cat_bits.append(f"{k.replace('_', ' ')}={round(float(v))}")
    if cat_bits:
        lines.append("By category: " + ", ".join(cat_bits))
    if critical:
        top = [str((f or {}).get("title", ""))[:90] for f in critical[:3]]
        lines.append("Top critical findings: " + " | ".join(t for t in top if t))
    if warnings:
        lines.append(f"Warnings outstanding: {len(warnings)}")
    return "\n".join(lines)


def _build_dev_health_section(dev_health: dict) -> str:
    if not dev_health:
        return ""
    spec = dev_health.get("spec_alignment")
    stand = dev_health.get("standards")
    quality = dev_health.get("code_quality")
    overall = dev_health.get("overall")
    if all(v is None for v in (spec, stand, quality, overall)):
        return ""

    def _fmt(v):
        return f"{int(v)}%" if isinstance(v, (int, float)) else "n/a"
    return (
        "\n\n--- DEVELOPMENT HEALTH ---\n"
        f"Overall: {_fmt(overall)} | "
        f"Spec Alignment: {_fmt(spec)} | "
        f"Standards: {_fmt(stand)} | "
        f"Code Quality: {_fmt(quality)}"
    )


def _build_milestone_section(milestones: list[dict]) -> str:
    if not milestones:
        return ""
    lines = ["\n\n--- MILESTONES ---"]
    for m in milestones[:10]:
        due = m.get("due_date") or "no due date"
        lines.append(
            f"- {m.get('title')} ({m.get('done', 0)}/{m.get('total', 0)} tasks, "
            f"{m.get('pct', 0)}%) due {due}",
        )
    return "\n".join(lines)


def _build_bug_section(bugs: dict) -> str:
    if not bugs or not bugs.get("total"):
        return "\n\n--- BUGS --- (none reported)"
    lines = [
        "\n\n--- BUGS ---",
        f"Total: {bugs.get('total', 0)}. Status: {json.dumps(bugs.get('by_status', {}))}",
    ]
    open_titles = bugs.get("open_titles") or []
    if open_titles:
        lines.append("Open bug titles: " + "; ".join(t[:80] for t in open_titles))
    return "\n".join(lines)


_SYSTEM_PROMPT = (
    "You are a senior project health analyst writing for an engineering "
    "manager who needs to make decisions TODAY. You receive project metrics, "
    "task details, a code-evidence scan, a static-analysis audit (security / "
    "dependencies / code quality / project hygiene), development-health "
    "sub-scores, milestones, and bugs. Integrate ALL signals, not just the "
    "task list.\n\n"
    "QUALITY BAR — every sentence must earn its place:\n"
    "- Cite specific facts: task titles, assignee names, due dates, audit "
    "scores, CVE counts, milestone names, file/feature names. Never write "
    "generic filler like 'overall progress is steady'.\n"
    "- Rank risks by impact, most critical first. A security CVE beats a "
    "stylistic audit warning.\n"
    "- Every recommendation must be actionable: name WHO should do WHAT by "
    "WHEN. 'Review code quality' fails; 'Assign the 5 reported bugs in "
    "Interactive Debate Mode to Rafay Majeed before the 2026-04-30 milestone' "
    "passes.\n"
    "- Distinguish real risk (overdue work, blocked milestones, failed scans) "
    "from noise (hygiene nits on a shipped project). Say so when a low score "
    "doesn't matter given context.\n"
    "- If the project is healthy, say so confidently. Don't invent risks to "
    "fill space.\n\n"
    "Return ONLY valid JSON with these keys:\n"
    '- "health_assessment": 2-3 sentence overall summary. END with one '
    "label in brackets: [ON TRACK] / [AT RISK] / [CRITICAL] / [BLOCKED] / "
    "[COMPLETE]. Base the label on overdue work, milestone slippage, bug "
    "count, and scan coverage — not just task completion pct.\n"
    '- "risk_factors": array of 2-5 risk strings. One risk per string, '
    "ordered most-critical first. Reference the specific task / finding / "
    "bug that creates the risk. If the project has fewer than 2 real risks, "
    "return 1 or even an empty array rather than inventing filler.\n"
    '- "recommendations": array of 2-5 actions. Each must answer WHO+WHAT+'
    "WHEN. Tie to specific audit categories, tasks, or milestones. Order by "
    "urgency.\n"
    '- "dev_contribution_summary": 2-3 sentence summary of development '
    "progress mentioning developer names, specific completed feature areas, "
    "and code evidence quality. Call out any single developer carrying a "
    "disproportionate share of the work.\n\n"
    "No markdown fences. No explanation. Just JSON."
)
