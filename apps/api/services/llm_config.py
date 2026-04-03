"""Shared LLM configuration — single source of truth for all AI services."""

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from apps.api.models.settings import OrgSetting

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Immutable default prompts — safety net when org settings are missing/corrupt
# ---------------------------------------------------------------------------

DEFAULT_PROMPTS: dict[str, str] = {
    "chat": (
        "CRITICAL: You MUST reply in plain English sentences. NEVER output JSON.\n\n"
        "You are Mizan, an AI assistant for product lifecycle management.\n\n"
        "OUTPUT FORMAT — MANDATORY:\n"
        "- Respond ONLY in natural language sentences and bullet points.\n"
        "- FORBIDDEN characters in your response: { } [ ] (curly braces, square brackets)\n"
        "- FORBIDDEN patterns: ```json, ```, \"key\": \"value\", any JSON syntax\n"
        "- If you feel tempted to output JSON, STOP and rewrite as plain English.\n\n"
        "EXAMPLE — User asks: 'what are the total number of tasks in the Enlyte project?'\n"
        "WRONG: {\"total_tasks\": 15, \"completed_tasks\": 15}\n"
        "CORRECT: The Enlyte project has 15 tasks total, with all 15 completed (100% completion rate).\n\n"
        "EXAMPLE — User asks: 'who are the free AI engineers?'\n"
        "WRONG: {\"free_engineers_list\": [\"Sheraz Ahmad\", \"Haris Ahmed\"]}\n"
        "CORRECT: The available AI engineers are:\n"
        "- Sheraz Ahmad\n"
        "- Haris Ahmed\n\n"
        "RESPONSE RULES:\n"
        "- Answer ONLY the current question. NEVER repeat or reference previous answers.\n"
        "- 'Who is working on X?' → List names and roles only.\n"
        "- 'Who is X?' → Name, role, and projects only.\n"
        "- 'How many tasks?' → The number with brief breakdown.\n"
        "- 'Status of X?' → Stage, completion, blockers only.\n"
        "- Keep responses SHORT: 2-5 lines for simple questions.\n"
        "- No 'Note:', 'Additionally:', or unsolicited extras.\n\n"
        "NAME MATCHING:\n"
        "- Handle typos, partial names, abbreviations intelligently.\n"
        "- If ambiguous, ask to clarify.\n\n"
        "The context data below is for reference. Convert it to natural language.\n\n"
        "REMINDER: Plain English only. No JSON. No code blocks. No curly braces."
    ),
    "spec_generation_rules": (
        "IMPORTANT rules for the 'features' array:\n"
        "- Each feature 'name' must be concise (3-6 words). "
        "Do NOT cram details into the name.\n"
        "- EVERY feature MUST have a non-empty 'description' field. "
        "Never omit or leave it blank. Write two short paragraphs "
        "separated by a newline: (1) what the feature does and the "
        "user problem it solves, (2) expected behavior and key "
        "implementation considerations. Each description must be "
        "unique, specific, and plain text (no markdown).\n"
        "- Each feature 'acceptance_criteria' MUST contain 2-4 specific, "
        "testable criteria unique to that feature. "
        "Do NOT use generic criteria.\n"
        "- Each feature MUST have a 'priority' field "
        "(one of: 'high', 'medium', 'low').\n"
    ),
    "qa_check": (
        "Generate a QA checklist for a software product. "
        "Return ONLY a JSON array of objects with keys: title, category, description. "
        "Categories should be: functionality, performance, security, accessibility, ux. "
        "Generate 8-12 items. No markdown, just valid JSON array."
    ),
    "system_docs": {
        "functional_spec": (
            "You are a technical writer. Generate a comprehensive functional specification "
            "in Markdown format. Include: executive summary, feature catalog with descriptions, "
            "user stories, data models, user flows, API endpoints, business rules, and "
            "acceptance criteria. Base everything on the provided source material."
        ),
        "implementation_spec": (
            "You are a software architect. Generate an implementation specification "
            "in Markdown format. Include: architecture overview, technology stack analysis, "
            "code patterns and conventions, layer descriptions, data layer design, API "
            "structure, dependency map, and development guidelines. Base everything on the "
            "provided source material."
        ),
        "deployment_docs": (
            "You are a DevOps engineer. Generate deployment documentation "
            "in Markdown format. Include: prerequisites, setup guide, environment "
            "configuration, build and deploy steps, CI/CD pipeline recommendations, "
            "monitoring setup, scaling considerations, and troubleshooting guide. "
            "Base everything on the provided source material."
        ),
    },
}

KNOWN_PROVIDERS = {"openrouter", "openai"}


# ---------------------------------------------------------------------------
# LLMConfig dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LLMConfig:
    """Resolved LLM connection settings."""

    api_key: str
    base_url: str | None
    model: str
    temperature: float
    max_tokens: int


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

async def get_llm_config(session: AsyncSession) -> LLMConfig:
    """Return LLM config from org settings, falling back to env vars."""
    api_key = settings.openrouter_api_key or settings.openai_api_key
    if not api_key:
        raise ValueError(
            "No LLM API key configured. "
            "Set OPENROUTER_API_KEY or OPENAI_API_KEY in your environment."
        )

    # Env-based defaults
    default_base_url = (
        "https://openrouter.ai/api/v1" if settings.openrouter_api_key else None
    )
    default_model = (
        "anthropic/claude-sonnet-4" if settings.openrouter_api_key else "gpt-4o"
    )

    org_cfg = await _read_org_setting(session, "ai_model_config")
    if not isinstance(org_cfg, dict):
        return LLMConfig(
            api_key=api_key,
            base_url=default_base_url,
            model=default_model,
            temperature=0.3,
            max_tokens=1024,
        )

    provider = org_cfg.get("provider", "")
    model = org_cfg.get("model", "")
    if not isinstance(model, str) or not model.strip():
        model = default_model

    base_url = default_base_url
    if provider == "openai":
        base_url = None
    elif provider == "openrouter":
        base_url = "https://openrouter.ai/api/v1"

    temperature = org_cfg.get("temperature", 0.3)
    if not isinstance(temperature, (int, float)) or not (0.0 <= temperature <= 2.0):
        temperature = 0.3

    max_tokens = org_cfg.get("max_tokens", 1024)
    if not isinstance(max_tokens, int) or max_tokens < 1:
        max_tokens = 1024

    return LLMConfig(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )


_CHAT_FORMAT_RULE = (
    "CRITICAL: You MUST reply in plain English sentences. NEVER output JSON, "
    "code blocks, or structured data. No { } [ ] characters allowed in your response.\n\n"
)


async def get_system_prompt(session: AsyncSession, feature_key: str) -> str:
    """Return the system prompt for *feature_key*, falling back to defaults."""
    default = DEFAULT_PROMPTS.get(feature_key, "")
    if isinstance(default, dict):
        return ""  # nested prompts (system_docs) are resolved via sub-key

    org_prompts = await _read_org_setting(session, "ai_system_prompts")
    if not isinstance(org_prompts, dict):
        return default

    stored = org_prompts.get(feature_key)
    if isinstance(stored, str) and stored.strip():
        # For chat prompts, always prepend the format rule to prevent JSON output
        if feature_key == "chat":
            return _CHAT_FORMAT_RULE + stored
        return stored
    return default


async def get_system_doc_prompt(session: AsyncSession, doc_type: str) -> str:
    """Return the system-doc prompt for a specific doc type."""
    defaults = DEFAULT_PROMPTS.get("system_docs", {})
    default = defaults.get(doc_type, "") if isinstance(defaults, dict) else ""

    org_prompts = await _read_org_setting(session, "ai_system_prompts")
    if not isinstance(org_prompts, dict):
        return default

    system_docs = org_prompts.get("system_docs")
    if isinstance(system_docs, dict):
        stored = system_docs.get(doc_type)
        if isinstance(stored, str) and stored.strip():
            return stored
    return default


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

async def _read_org_setting(session: AsyncSession, key: str) -> dict | None:
    """Read a single org setting value, returning None on any failure."""
    try:
        stmt = select(OrgSetting.value).where(OrgSetting.key == key)
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        return row if isinstance(row, dict) else None
    except Exception:
        logger.warning("Failed to read org setting '%s', using defaults", key)
        return None
