"""Build plain-text task descriptions from specification features."""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.specification import SpecificationFeature
from apps.api.services.llm_config import get_llm_config

logger = logging.getLogger(__name__)


def build_task_description(feature: SpecificationFeature) -> str:
    """Compose a plain-text task description from feature data.

    Produces a description with the feature body followed by numbered
    acceptance criteria.  No markdown, no headings, no tech context.
    """
    sections: list[str] = []

    if feature.description:
        sections.append(feature.description)

    criteria = feature.acceptance_criteria
    if isinstance(criteria, list) and criteria:
        items = "\n".join(f"{i}. {c}" for i, c in enumerate(criteria, 1))
        sections.append(f"Acceptance Criteria:\n{items}")

    return "\n\n".join(sections) if sections else feature.name


async def fill_missing_descriptions(
    session: AsyncSession,
    features: list[SpecificationFeature],
    spec_content: dict | None,
) -> None:
    """Generate AI descriptions for features that lack one.

    Mutates features in-place so the caller can persist them.
    """
    missing = [f for f in features if not f.description]
    if not missing:
        return

    spec = spec_content or {}
    summary = spec.get("summary", "")
    feature_details = []
    for f in missing:
        detail = f"- {f.name}"
        if isinstance(f.acceptance_criteria, list) and f.acceptance_criteria:
            detail += f" (criteria: {', '.join(str(c) for c in f.acceptance_criteria[:3])})"
        if f.priority:
            detail += f" [priority: {f.priority}]"
        feature_details.append(detail)
    feature_list = "\n".join(feature_details)

    prompt = (
        "Generate a UNIQUE plain-text description for EACH feature below. "
        "Each description MUST be different and specific to that feature. "
        "Structure as two short paragraphs separated by \\n\\n:\n"
        "- Paragraph 1: What this specific feature does and what user problem it solves.\n"
        "- Paragraph 2: Expected behavior and key implementation considerations.\n\n"
        "Keep each paragraph 2-3 sentences. Use plain text only, no markdown. "
        "Do NOT reuse descriptions across features.\n\n"
        f"Project summary: {summary}\n\n"
        f"Features needing descriptions:\n{feature_list}\n\n"
        "Respond ONLY with valid JSON (no markdown, no code fences). "
        'Format: {{"descriptions": {{"Feature Name": "description text", ...}}}}'
    )

    try:
        import openai

        config = await get_llm_config(session)
        client = openai.AsyncOpenAI(
            api_key=config.api_key, base_url=config.base_url,
            timeout=150.0,
        )
        response = await client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or "{}"
        from packages.common.utils.json_utils import extract_json_text
        data = json.loads(extract_json_text(raw))
        descriptions = data.get("descriptions", {})

        for f in missing:
            desc = descriptions.get(f.name)
            if isinstance(desc, str) and desc.strip():
                f.description = desc.strip()
    except Exception:
        logger.warning("AI description generation failed, features will use name only", exc_info=True)
