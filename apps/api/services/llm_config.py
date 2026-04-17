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
        "FORMATTING (rendered as Markdown in the UI):\n"
        "- When listing items (tasks, bugs, people, statuses), ALWAYS use a bulleted list with `- ` at the start of each line.\n"
        "- ONE ITEM PER BULLET. Each task, bug, or person goes on its own line starting with `- `. NEVER cram multiple items into a single bullet separated by commas.\n"
        "- Put a space after any bold label. `**Status**: done` not `**Status**done`.\n"
        "- Task bullet format: `- **Task title** — status — Assignee Name` (use em-dash or hyphen between parts, with spaces).\n"
        "- When grouping tasks by status, use a short header line like `**Done (12)**` on its own line, blank line, then the task bullets under it.\n"
        "- Use **bold** for names, numbers, statuses, and key facts.\n"
        "- Keep each bullet to one line. No sub-bullets. No nested lists.\n"
        "- Start with a one-line summary sentence, then a blank line, then the bullets.\n"
        "- Cap task lists at ~15 items. If there are more, show the top 15 and end with `- …and N more`.\n\n"
        "RESPONSE LENGTH:\n"
        "- 'Who is X?' → 1 bold name + 1-2 lines of role/project detail. No bullets needed.\n"
        "- 'How many tasks?' → 1-line summary, then a short bulleted breakdown by status.\n"
        "- 'Status of X?' → 1-line status summary, then 2-4 bullets for stage / completion / blockers.\n"
        "- 'Tell me the tasks' / 'list bugs' → 1-line intro, then a bulleted list with ONE task per bullet (max 15, then `…and N more`).\n"
        "- Simple questions get simple answers. Bulleted answers stay short.\n\n"
        "FORBIDDEN:\n"
        "- JSON, code blocks, { } [ ] characters\n"
        "- Repeating previous answers\n"
        "- 'Note:', 'Additionally:', 'Also:', 'Furthermore:'\n"
        "- Answering questions the user didn't ask\n"
        "- Wall-of-text paragraphs when a bulleted list would be clearer\n"
        "- Sub-bullets or nested lists\n\n"
        "NAME MATCHING: Handle typos and partial names intelligently.\n\n"
        "WORKLOAD QUESTIONS: When asked 'who is free', 'who is busy', 'who is "
        "overloaded', 'who has the most/fewest tasks' — USE the WORKLOAD BY "
        "ROLE block in the context. 'Free' means 0 active AND 0 overdue tasks. "
        "'Overloaded' means high active count or many overdue.\n"
        "- COUNTING RULE (CRITICAL): when asked 'how many X are Y' (e.g. "
        "'how many developers are free'), you MUST scan the ENTIRE relevant "
        "role section, count ALL matching people, and state that exact number. "
        "Never sample the first few, never guess, never round down. "
        "If 7 people match, say 7 and list all 7.\n"
        "- LISTING RULE: when you state a count, list ALL matching people "
        "(up to the 15-bullet cap). If the answer is '7 engineers are free', "
        "the reply must have 7 bullets naming each person. Do NOT truncate to "
        "3 or 5 for brevity.\n"
        "- If the user asks about a specific role (e.g. 'AI engineers', "
        "'developers', 'devs', 'PMs', 'project managers', 'operations', "
        "'marketing'), ONLY list people from that role section.\n"
        "  - 'AI engineer' / 'developer' / 'dev' → role `engineer`\n"
        "  - 'PM' / 'project manager' → role `project_manager`\n"
        "- Never mix roles. If the user asked about engineers, do NOT include "
        "project_manager / operations / marketing / etc.\n"
        "- Never say 'I don't have a real-time view' — the workload block IS "
        "real-time; answer from it.\n\n"
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
        "openai/gpt-5.4-mini" if settings.openrouter_api_key else "gpt-4o"
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
    "FORMATTING: the UI renders your reply as Markdown. When the answer is a list "
    "(tasks, bugs, people, statuses), use bulleted lines starting with '- '. "
    "ONE ITEM PER BULLET — never cram multiple tasks into a single bullet with "
    "commas. Each task goes on its own line: `- **Task title** — status — Assignee`. "
    "Put a space after every bold label (`**Status**: done`, NOT `**Status**done`). "
    "When grouping, use a short header line like `**Done (12)**` then a blank line "
    "then the bullets. Put a one-line summary first, then a blank line, then the "
    "list. Cap task lists at ~15 items; if more, end with `- …and N more`. "
    "Keep bullets to one line each — no nesting.\n\n"
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
