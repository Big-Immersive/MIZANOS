"""Build prompt context and parse responses for specification generation."""

import json

_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"}

_SPEC_FORMAT = {
    "summary": "High-level product summary",
    "functionalSpec": {
        "userStories": ["As a [user], I want [goal] so that [benefit]"],
        "businessRules": ["Rule describing business logic"],
        "acceptanceCriteria": ["Testable acceptance criterion"],
    },
    "technicalSpec": {
        "architecture": "Description of system architecture",
        "dataModels": ["Model/entity description"],
        "integrations": ["External service or API integration"],
        "nonFunctionalRequirements": [
            "Performance, security, or scalability requirement"
        ],
    },
    "features": [
        {
            "name": "Short feature name (3-6 words)",
            "description": (
                "Two short paragraphs separated by a newline: "
                "(1) What the feature does and the user problem it solves. "
                "(2) Expected behavior and key implementation considerations. "
                "Plain text only, no markdown. MUST be unique and specific."
            ),
            "acceptance_criteria": [
                "Specific, testable criterion for this feature",
                "Another measurable criterion unique to this feature",
            ],
            "priority": "high | medium | low",
        }
    ],
    "techStack": ["Technology name"],
    "qaChecklist": ["QA test or check item"],
}


def _is_image_source(src) -> bool:
    """Check if a source is an image file."""
    if src.file_name:
        ext = "." + src.file_name.rsplit(".", 1)[-1].lower() if "." in src.file_name else ""
        if ext in _IMAGE_EXTENSIONS:
            return True
    return False


def build_source_context(
    sources: list,
    product_name: str,
    pillar: str | None,
) -> tuple[str, list[str]]:
    """Build context string and image file paths from saved sources.

    Returns (text_context, image_file_paths).
    """
    parts: list[str] = []
    image_paths: list[str] = []

    for src in sources:
        source_type = src.source_type or "unknown"
        header = f"[{source_type.upper()} SOURCE]"

        if source_type == "website" and src.url:
            header = f"[WEBSITE: {src.url}]"
            lines = [header]
            if src.ai_summary:
                summary = src.ai_summary
                if isinstance(summary, dict):
                    for k, v in summary.items():
                        lines.append(f"  {k}: {v}")
                else:
                    lines.append(f"  Summary: {summary}")
            if src.branding and isinstance(src.branding, dict):
                for k, v in src.branding.items():
                    lines.append(f"  Branding {k}: {v}")
            if src.raw_content:
                lines.append(src.raw_content[:2000])
            parts.append("\n".join(lines))

        elif source_type in ("paste", "markdown"):
            lines = [header]
            if src.raw_content:
                lines.append(src.raw_content[:2000])
            parts.append("\n".join(lines))

        elif source_type == "document":
            if _is_image_source(src) and src.file_url and not src.raw_content:
                image_paths.append(src.file_url)
                parts.append(f"[IMAGE: {src.file_name or 'image'}]")
            else:
                lines = [header]
                if src.file_name:
                    lines.append(f"File: {src.file_name}")
                if src.raw_content:
                    lines.append(src.raw_content[:2000])
                parts.append("\n".join(lines))

        elif source_type == "audio":
            lines = [header]
            if src.transcription:
                lines.append(f"Transcription: {src.transcription[:2000]}")
            parts.append("\n".join(lines))

        else:
            lines = [header]
            if src.url:
                lines.append(f"URL: {src.url}")
            if src.raw_content:
                lines.append(src.raw_content[:2000])
            if src.transcription:
                lines.append(f"Transcription: {src.transcription[:2000]}")
            parts.append("\n".join(lines))

    source_block = "\n\n".join(parts) if parts else "(no source material)"
    text_context = (
        f"Project: {product_name}\n"
        f"Pillar: {pillar or 'N/A'}\n\n"
        f"Source Material:\n{source_block}"
    )
    return text_context, image_paths


def _format_tech_stack(tech: dict) -> str:
    """Format a TechStackInfo dict into a readable prompt block."""
    lines: list[str] = [
        "DETECTED TECH STACK (from actual project repository "
        "— use these as the techStack, do NOT guess):"
    ]
    for label, key in (
        ("Languages", "languages"),
        ("Frameworks", "frameworks"),
        ("Databases", "databases"),
        ("Package Managers", "package_managers"),
        ("Notable Dependencies", "notable_deps"),
    ):
        items = tech.get(key)
        if isinstance(items, list) and items:
            lines.append(f"  {label}: {', '.join(str(i) for i in items)}")
    return "\n".join(lines)


def build_spec_prompt(
    product_name: str,
    context: str,
    custom_instructions: str | None = None,
    has_images: bool = False,
    detected_tech_stack: dict | None = None,
    feature_rules_override: str | None = None,
) -> str:
    """Build the LLM prompt for spec generation."""
    spec_format = json.dumps(_SPEC_FORMAT)
    instruction_block = ""
    if custom_instructions:
        instruction_block = (
            f"\n\nCustom Instructions from the user:\n{custom_instructions}\n"
        )
    image_block = ""
    if has_images:
        image_block = (
            "\n\nThe attached images are uploaded source documents. "
            "Analyze their content and incorporate relevant details "
            "into the specification.\n"
        )
    tech_block = ""
    if detected_tech_stack and isinstance(detected_tech_stack, dict):
        tech_block = "\n\n" + _format_tech_stack(detected_tech_stack) + "\n"

    feature_rules = feature_rules_override or (
        "\n\nIMPORTANT rules for the 'features' array:\n"
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
    )
    return (
        f'Generate a detailed product specification for "{product_name}".\n\n'
        f"{context}"
        f"{instruction_block}"
        f"{image_block}"
        f"{tech_block}"
        f"{feature_rules}\n"
        "Respond ONLY with valid JSON (no markdown, no code fences) "
        f"in this exact format:\n{spec_format}"
    )


def parse_spec_response(content: str) -> dict:
    """Parse LLM response JSON with fallback defaults."""
    from packages.common.utils.json_utils import extract_json_text

    raw = json.loads(extract_json_text(content))
    return {
        "summary": raw.get("summary", ""),
        "functionalSpec": raw.get("functionalSpec", {
            "userStories": [], "businessRules": [], "acceptanceCriteria": [],
        }),
        "technicalSpec": raw.get("technicalSpec", {
            "architecture": "", "dataModels": [], "integrations": [],
            "nonFunctionalRequirements": [],
        }),
        "features": raw.get("features", []),
        "techStack": raw.get("techStack", []),
        "qaChecklist": raw.get("qaChecklist", []),
    }
