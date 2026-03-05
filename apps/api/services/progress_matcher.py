"""Progress matcher — uses LLM to match tasks against extracted code artifacts."""

import json
import logging

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.services.llm_config import get_llm_config
from apps.api.services.scan_prompts import (
    HIGH_LEVEL_SYSTEM_PROMPT,
    HIGH_LEVEL_USER_TEMPLATE,
    TASK_EVIDENCE_SCHEMA,
)

logger = logging.getLogger(__name__)

_DEFAULT_RESULT = {
    "scan_summary": {
        "total_tasks": 0,
        "verified": 0,
        "partial": 0,
        "no_evidence": 0,
        "progress_pct": 0.0,
    },
    "task_evidence": [],
}


class ProgressMatcherService:
    """Sends tasks + artifacts to an LLM for evidence matching."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def match(self, tasks: list[dict], artifacts: dict) -> dict:
        """Call LLM to match tasks against extracted artifacts."""
        if not tasks:
            return _DEFAULT_RESULT

        llm_cfg = await get_llm_config(self.session)

        tasks_json = json.dumps(tasks, indent=2, default=str)
        artifacts_json = json.dumps(self._trim_artifacts(artifacts), indent=2)

        system_msg = HIGH_LEVEL_SYSTEM_PROMPT + TASK_EVIDENCE_SCHEMA
        user_msg = HIGH_LEVEL_USER_TEMPLATE.format(
            tasks_json=tasks_json, artifacts_json=artifacts_json,
        )

        client = AsyncOpenAI(api_key=llm_cfg.api_key, base_url=llm_cfg.base_url)
        response = await client.chat.completions.create(
            model=llm_cfg.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0,
            max_tokens=llm_cfg.max_tokens,
            seed=42,
        )

        raw = response.choices[0].message.content or ""
        return self._parse_response(raw, len(tasks))

    @staticmethod
    def _trim_artifacts(artifacts: dict) -> dict:
        """Limit artifact lists to avoid exceeding token limits."""
        trimmed = {}
        max_items = 200
        for key, value in artifacts.items():
            if isinstance(value, list) and len(value) > max_items:
                trimmed[key] = value[:max_items]
            else:
                trimmed[key] = value
        return trimmed

    @staticmethod
    def _parse_response(raw: str, total_tasks: int) -> dict:
        """Parse the LLM JSON response, falling back gracefully."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("Failed to parse LLM response as JSON")
            return {
                "scan_summary": {
                    "total_tasks": total_tasks,
                    "verified": 0,
                    "partial": 0,
                    "no_evidence": total_tasks,
                    "progress_pct": 0.0,
                },
                "task_evidence": [],
                "raw_response": raw[:500],
            }

        # Always recompute summary server-side for consistency
        result["scan_summary"] = _compute_summary(
            result.get("task_evidence", []), total_tasks,
        )
        return result


def _compute_summary(evidence: list[dict], total: int) -> dict:
    """Compute summary stats from task evidence list."""
    verified = sum(1 for e in evidence if e.get("verified"))
    partial = sum(
        1 for e in evidence
        if not e.get("verified") and e.get("confidence", 0) >= 0.3
    )
    no_evidence = total - verified - partial
    pct = (verified / total * 100) if total > 0 else 0.0
    return {
        "total_tasks": total,
        "verified": verified,
        "partial": partial,
        "no_evidence": max(no_evidence, 0),
        "progress_pct": round(pct, 1),
    }
