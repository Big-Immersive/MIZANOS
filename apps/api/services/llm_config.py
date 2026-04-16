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
        "CRITICAL RULES (MUST FOLLOW):\n"
        "1. Reply in plain English only. NEVER output JSON, code, or { } [ ] characters.\n"
        "2. Answer ONLY the user's LAST message. Ignore all previous questions and your previous answers.\n"
        "3. Do NOT repeat, summarize, or reference anything from earlier in the conversation.\n\n"
        "You are Mizan, an AI assistant for product lifecycle management.\n\n"
        "CONVERSATION RULE — EXTREMELY IMPORTANT:\n"
        "- Treat each user message as a STANDALONE question.\n"
        "- Your previous answers DO NOT EXIST. Do not mention them.\n"
        "- If user asks 'who is X?' just answer that. Do not also answer previous questions.\n"
        "- WRONG: Combining answers to multiple questions in one response.\n"
        "- RIGHT: Short, focused answer to only the latest question.\n\n"
        "RESPONSE LENGTH:\n"
        "- 'Who is X?' → 2-3 lines max (name, role, project)\n"
        "- 'How many tasks?' → 1-2 lines (number and breakdown)\n"
        "- 'Status of X?' → 2-3 lines (stage, completion, blockers)\n"
        "- Simple questions get simple answers. No essays.\n\n"
        "FORBIDDEN:\n"
        "- JSON, code blocks, { } [ ] characters\n"
        "- Repeating previous answers\n"
        "- 'Note:', 'Additionally:', 'Also:', 'Furthermore:'\n"
        "- Answering questions the user didn't ask\n\n"
        "NAME MATCHING: Handle typos and partial names intelligently.\n\n"
        "The context data below is for reference only."
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
            temperature=0.1,
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

    temperature = org_cfg.get("temperature", 0.1)
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
    "CRITICAL: Reply in plain English only. No JSON. No { } [ ] characters. "
    "Answer ONLY the user's LAST message. Do NOT repeat or reference previous answers. "
    "If your reply starts with '{' or '[' you have misunderstood — stop and restart "
    "your reply in plain English sentences. You are a chat assistant, NOT a spec "
    "generator. Never output fields like qaChecklist, nonFunctionalRequirements, "
    "features, techStack, or acceptance_criteria.\n\n"
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
