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
    "file_tree": 120, "routes": 80, "models": 60,
    "schemas": 50, "components": 80, "functions": 80,
    "pages": 50, "migrations": 20, "configs": 10,
}

BATCH_SIZE = 20


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

        # Batch for large task lists — run in parallel
        batches = [tasks[i:i + BATCH_SIZE] for i in range(0, len(tasks), BATCH_SIZE)]
        logger.info("Splitting %d tasks into %d batches (parallel)", len(tasks), len(batches))

        results = await asyncio.gather(
            *(self._match_batch(batch, trimmed, llm_cfg) for batch in batches),
            return_exceptions=True,
        )

        all_evidence: list[dict] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning("Batch %d failed: %s", i, result)
                continue
            all_evidence.extend(result.get("task_evidence", []))

        _apply_done_task_trust(all_evidence)
        summary = _compute_summary(all_evidence, len(tasks))
        return {"scan_summary": summary, "task_evidence": all_evidence}

    @staticmethod
    def _compact_tasks(tasks: list[dict]) -> list[dict]:
        """Strip task fields the LLM doesn't need to reduce input tokens."""
        return [
            {
                "task_id": t["task_id"],
                "title": t["title"],
                "description": (t.get("description") or "")[:150],
                "status": t.get("status", ""),
                "verification_criteria": (t.get("verification_criteria") or "")[:200],
            }
            for t in tasks
        ]

    async def _match_batch(self, tasks: list[dict], artifacts: dict, llm_cfg) -> dict:
        """Match a single batch of tasks against artifacts."""
        compact_tasks = self._compact_tasks(tasks)
        tasks_json = json.dumps(compact_tasks, separators=(",", ":"), default=str)
        truncation_note = self._truncation_note(artifacts)

        _dump = lambda v: json.dumps(v, separators=(",", ":"))

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
            routes_json=_dump(artifacts.get("routes", [])),
            models_json=_dump(artifacts.get("models", [])),
            schemas_json=_dump(artifacts.get("schemas", [])),
            components_json=_dump(artifacts.get("components", [])),
            functions_json=_dump(artifacts.get("functions", [])),
            file_tree_json="\n".join(artifacts.get("file_tree", [])),
        )

        system_msg = HIGH_LEVEL_SYSTEM_PROMPT + TASK_EVIDENCE_SCHEMA
        client = AsyncOpenAI(
            api_key=llm_cfg.api_key,
            base_url=llm_cfg.base_url,
            timeout=120.0,
        )

        # Lean max_tokens: ~120 tokens per task for output JSON
        scan_max_tokens = min(max(llm_cfg.max_tokens, len(tasks) * 120 + 256), 4096)

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=llm_cfg.model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.2,
                max_tokens=scan_max_tokens,
            ),
            timeout=180.0,
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
        from packages.common.utils.json_utils import extract_json_text

        cleaned = extract_json_text(raw)

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

        evidence = result.get("task_evidence", []) or []
        _apply_done_task_trust(evidence)
        result["task_evidence"] = evidence
        # Always recompute summary from the (clamped) evidence list so the
        # verified/partial/no_evidence counts agree with the per-task view.
        result["scan_summary"] = _compute_summary(evidence, total_tasks)
        return result


_DONE_STATUSES = {"done", "completed", "live"}


def _apply_done_task_trust(evidence: list[dict]) -> None:
    """If the task owner marked it Done AND the scan found at least one
    artifact backing it up, treat the LLM's borderline match as Verified.

    Prevents the common false-Partial on shipped tasks where the
    verification criteria is vague and the LLM can't be fully confident
    even though real code exists. Mutates `evidence` in place.
    """
    for e in evidence:
        if e.get("verified"):
            continue
        status = str(e.get("status_in_pm") or "").lower()
        artifacts = e.get("artifacts_found") or []
        if status in _DONE_STATUSES and len(artifacts) > 0:
            e["verified"] = True
            e["trust_reason"] = "done_with_artifacts"


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
