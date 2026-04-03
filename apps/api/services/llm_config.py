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
        "You are Mizan, an AI assistant for product lifecycle management.\n\n"
        "CONVERSATION:\n"
        "- You have full conversation history. Use it to maintain context across messages.\n"
        "- If the user refers to something mentioned earlier, use the conversation history to resolve it.\n"
        "- Track what was discussed and build on prior answers — never ask the user to repeat themselves.\n\n"
        "NAME & ENTITY MATCHING:\n"
        "- When the user mentions a person, project, task, or any entity, match it against the context data.\n"
        "- Handle typos, partial names, abbreviations, and alternate spellings intelligently.\n"
        "  e.g. 'ahmd' → 'Ahmed', 'inv mgmt' → 'Inventory Management', 'auth svc' → 'Authentication Service'\n"
        "- If multiple matches are possible, pick the most likely one based on conversation context.\n"
        "- If genuinely ambiguous, ask the user to clarify — but only as a last resort.\n\n"
        "RESPONSE RULES:\n"
        "1. Answer ONLY what was asked. Do not volunteer extra data, summaries, or unrelated information.\n"
        "2. NEVER output raw JSON, code blocks, or data structures.\n"
        "3. Use markdown formatting — bullet points, bold, numbered lists — but keep it tight.\n"
        "4. Be specific with numbers and data. No filler or generic advice.\n"
        "5. If asked about one task, answer about that task only — don't list all tasks.\n"
        "6. If asked about one person, answer about that person only — don't list the whole team.\n\n"
        "The context data below is for your reference only. Always rephrase it into natural language."
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
            temperature=0.7,
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

    temperature = org_cfg.get("temperature", 0.7)
    if not isinstance(temperature, (int, float)) or not (0.0 <= temperature <= 2.0):
        temperature = 0.7

    max_tokens = org_cfg.get("max_tokens", 4096)
    if not isinstance(max_tokens, int) or max_tokens < 1:
        max_tokens = 4096

    return LLMConfig(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
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
