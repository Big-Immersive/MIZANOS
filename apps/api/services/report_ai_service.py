"""AI-powered project report analysis with Redis caching."""

import json
import logging
from datetime import datetime, timezone
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from apps.api.services.llm_config import get_llm_config
from apps.api.services.report_service import ReportService

logger = logging.getLogger(__name__)

CACHE_TTL = 86400  # 24 hours
CACHE_PREFIX = "report_analysis"


class ReportAIService:
    """Generate and cache AI analysis for project reports."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def generate_analysis(self, product_id: UUID) -> dict:
        """Generate AI analysis for a project, caching the result."""
        report_svc = ReportService(self.session)
        report = await report_svc.get_project_report(product_id)

        prompt = self._build_prompt(report)
        analysis = await self._call_llm(prompt)
        analysis["generated_at"] = datetime.now(timezone.utc).isoformat()

        await self._cache_set(product_id, analysis)
        return analysis

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
            temperature=0.4,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or "{}"
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("AI returned non-JSON, wrapping as health_assessment")
            return {
                "health_assessment": raw,
                "risk_factors": [],
                "recommendations": [],
                "dev_contribution_summary": "",
            }

    # ------------------------------------------------------------------
    # Prompt builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(report: dict) -> str:
        tm = report.get("task_metrics", {})
        fm = report.get("feature_metrics", {})
        gm = report.get("github_metrics") or {}

        return (
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
            f"+{gm.get('total_lines_added', 0)}/-{gm.get('total_lines_removed', 0)} lines\n\n"
            "Analyze this project and respond with ONLY valid JSON."
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


_SYSTEM_PROMPT = (
    "You are a project health analyst. Given project metrics, produce a concise JSON analysis.\n"
    "Return ONLY valid JSON with these keys:\n"
    '- "health_assessment": 2-3 sentence overall health summary\n'
    '- "risk_factors": array of 2-4 short risk strings\n'
    '- "recommendations": array of 2-4 actionable recommendation strings\n'
    '- "dev_contribution_summary": 2-3 sentence summary of development progress\n'
    "No markdown fences. No explanation. Just JSON."
)
