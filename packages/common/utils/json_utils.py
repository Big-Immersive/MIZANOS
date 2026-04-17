"""Shared helpers for parsing LLM JSON output robustly across providers.

LLMs from different vendors wrap JSON differently:
  - Anthropic Claude returns clean JSON most of the time.
  - Google Gemini frequently wraps in ```json ... ``` markdown fences and
    occasionally prefixes with "Sure, here is the JSON:" style preambles.
  - OpenAI GPT is usually clean but also fences occasionally.

These helpers centralise the defence so each service doesn't reimplement
(or forget) the same stripping logic. Idempotent on already-clean JSON.
"""

from __future__ import annotations

import json
import re

_FENCE_OPEN = re.compile(r"^\s*```(?:json|javascript|js)?\s*\n?", re.IGNORECASE)
_FENCE_CLOSE = re.compile(r"\n?\s*```\s*$")


def extract_json_text(raw: str) -> str:
    """Strip markdown fences and leading preambles from LLM output.

    Returns text suitable for ``json.loads``. Leaves already-clean JSON
    unchanged. Returns empty string for empty/None input rather than
    raising so the caller can control the error path.
    """
    if not raw:
        return ""
    text = raw.strip()

    # Drop any leading preamble up to the first { or [.
    candidates = [i for i in (text.find("{"), text.find("[")) if i >= 0]
    if candidates:
        first = min(candidates)
        if first > 0:
            text = text[first:]

    # Strip a ```json (or plain ```) fence at either end, if present.
    text = _FENCE_OPEN.sub("", text)
    text = _FENCE_CLOSE.sub("", text)
    return text.strip()


def parse_json_lenient(raw: str, default=None):
    """``extract_json_text`` + ``json.loads``; return ``default`` on failure."""
    try:
        return json.loads(extract_json_text(raw))
    except (ValueError, TypeError):
        return default


__all__ = ["extract_json_text", "parse_json_lenient"]
