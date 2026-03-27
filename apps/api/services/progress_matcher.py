"""Progress matcher — uses LLM to match tasks against extracted code artifacts."""

import asyncio
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
        "total_tasks": 0, "verified": 0, "partial": 0,
        "no_evidence": 0, "progress_pct": 0.0,
    },
    "task_evidence": [],
}

_CATEGORY_LIMITS = {
    "file_tree": 300, "routes": 150, "models": 100,
    "schemas": 100, "components": 150, "functions": 150,
    "pages": 100, "migrations": 50, "configs": 20,
}

BATCH_SIZE = 18


class ProgressMatcherService:
    """Sends tasks + artifacts to an LLM for evidence matching."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def match(self, tasks: list[dict], artifacts: dict) -> dict:
        """Call LLM to match tasks against extracted artifacts."""
        if not tasks:
            return _DEFAULT_RESULT

        llm_cfg = await get_llm_config(self.session)
        trimmed = self._budget_artifacts(artifacts)

        if len(tasks) <= BATCH_SIZE:
            return await self._match_batch(tasks, trimmed, llm_cfg)

        # Batch for large task lists
        batches = [tasks[i:i + BATCH_SIZE] for i in range(0, len(tasks), BATCH_SIZE)]
        all_evidence: list[dict] = []

        for batch in batches:
            result = await self._match_batch(batch, trimmed, llm_cfg)
            all_evidence.extend(result.get("task_evidence", []))

        summary = _compute_summary(all_evidence, len(tasks))
        return {"scan_summary": summary, "task_evidence": all_evidence}

    async def _match_batch(self, tasks: list[dict], artifacts: dict, llm_cfg) -> dict:
        """Match a single batch of tasks against artifacts."""
        tasks_json = json.dumps(tasks, indent=2, default=str)
        truncation_note = self._truncation_note(artifacts)

        user_msg = HIGH_LEVEL_USER_TEMPLATE.format(
            task_count=len(tasks),
            file_count=len(artifacts.get("file_tree", [])),
            route_count=len(artifacts.get("routes", [])),
            model_count=len(artifacts.get("models", [])),
            schema_count=len(artifacts.get("schemas", [])),
            component_count=len(artifacts.get("components", [])),
            function_count=len(artifacts.get("functions", [])),
            truncation_note=truncation_note,
            tasks_json=tasks_json,
            routes_json=json.dumps(artifacts.get("routes", []), indent=1),
            models_json=json.dumps(artifacts.get("models", []), indent=1),
            schemas_json=json.dumps(artifacts.get("schemas", []), indent=1),
            components_json=json.dumps(artifacts.get("components", []), indent=1),
            functions_json=json.dumps(artifacts.get("functions", []), indent=1),
            file_tree_json=json.dumps(artifacts.get("file_tree", []), indent=1),
        )

        system_msg = HIGH_LEVEL_SYSTEM_PROMPT + TASK_EVIDENCE_SCHEMA
        client = AsyncOpenAI(api_key=llm_cfg.api_key, base_url=llm_cfg.base_url)

        response = await client.chat.completions.create(
            model=llm_cfg.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            max_tokens=llm_cfg.max_tokens,
        )

        raw = response.choices[0].message.content or ""
        return self._parse_response(raw, len(tasks))

    @staticmethod
    def _budget_artifacts(artifacts: dict) -> dict:
        """Limit artifact lists per category to stay within token budget."""
        trimmed = {}
        for key, value in artifacts.items():
            if isinstance(value, list):
                limit = _CATEGORY_LIMITS.get(key, 100)
                if len(value) > limit:
                    trimmed[key] = value[:limit]
                else:
                    trimmed[key] = value
            else:
                trimmed[key] = value
        return trimmed

    @staticmethod
    def _truncation_note(artifacts: dict) -> str:
        """Generate a note about truncated categories."""
        notes = []
        for key, value in artifacts.items():
            if isinstance(value, list):
                limit = _CATEGORY_LIMITS.get(key, 100)
                if len(value) >= limit:
                    notes.append(f"- {key}: showing {limit} of {len(value)}+ items")
        if notes:
            return "NOTE: Some artifact lists were truncated:\n" + "\n".join(notes)
        return ""

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
            logger.warning("Failed to parse LLM scan response as JSON")
            return {
                "scan_summary": {
                    "total_tasks": total_tasks, "verified": 0,
                    "partial": 0, "no_evidence": total_tasks, "progress_pct": 0.0,
                },
                "task_evidence": [],
                "raw_response": raw[:500],
            }

        if "scan_summary" not in result:
            result["scan_summary"] = _compute_summary(
                result.get("task_evidence", []), total_tasks,
            )
        return result


def _compute_summary(evidence: list[dict], total: int) -> dict:
    """Compute summary stats from task evidence list."""
    verified = sum(1 for e in evidence if e.get("verified"))
    partial = sum(
        1 for e in evidence
        if not e.get("verified") and e.get("confidence", 0) >= 0.25
    )
    no_evidence = total - verified - partial
    pct = ((verified + partial * 0.5) / total * 100) if total > 0 else 0.0
    return {
        "total_tasks": total,
        "verified": verified,
        "partial": partial,
        "no_evidence": max(no_evidence, 0),
        "progress_pct": round(pct, 1),
    }
