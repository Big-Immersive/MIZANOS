"""Parse uploaded files (CSV, PDF, DOCX) into checklist template items."""

import csv
import io
import json
import logging
from typing import Any

import httpx

from apps.api.config import settings

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """\
You are a project management assistant. Extract checklist items from the following document content.

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "template_name": "<suggested template name>",
  "template_type": "<one of: gtm, qa, development, or a custom type>",
  "items": [
    {
      "title": "<checklist item title>",
      "category": "<category like: planning, launch, testing, setup, review, general>",
      "default_status": "new"
    }
  ]
}

Rules:
- Extract every actionable item, task, step, or phase as a separate checklist item
- Assign a meaningful category to each item
- template_type should be "gtm" for marketing/launch docs, "qa" for testing/quality docs, "development" for tech/dev docs
- Keep titles concise but descriptive
- Extract ALL items, do not skip any

Document content:
"""


async def parse_csv(content: bytes) -> dict[str, Any]:
    """Parse a CSV file into template data."""
    text = content.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))

    items = []
    template_type = "general"

    # Normalize headers
    fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]

    for row in reader:
        normalized = {k.strip().lower(): v.strip() for k, v in row.items() if v}
        title = (
            normalized.get("title")
            or normalized.get("item")
            or normalized.get("task")
            or normalized.get("name")
            or normalized.get("checklist item")
            or ""
        )
        if not title:
            continue

        category = (
            normalized.get("category")
            or normalized.get("group")
            or normalized.get("phase")
            or normalized.get("section")
            or "general"
        )
        status = (
            normalized.get("status")
            or normalized.get("default_status")
            or "new"
        )
        item_type = (
            normalized.get("type")
            or normalized.get("template_type")
            or ""
        )
        if item_type and template_type == "general":
            template_type = item_type.lower().replace(" ", "_")

        items.append({
            "title": title,
            "category": category,
            "default_status": status if status in ("new", "in_progress", "in_review", "approved", "complete") else "new",
        })

    return {
        "template_name": "Imported from CSV",
        "template_type": template_type,
        "items": items,
    }


async def parse_with_ai(content: bytes, filename: str) -> dict[str, Any]:
    """Parse PDF/DOCX content using AI (OpenRouter)."""
    text = _extract_text(content, filename)
    if not text or len(text.strip()) < 20:
        return {"template_name": filename, "template_type": "general", "items": []}

    # Truncate to avoid token limits
    truncated = text[:8000]

    api_key = settings.openrouter_api_key
    if not api_key:
        logger.warning("No OpenRouter API key configured, cannot parse document with AI")
        return {"template_name": filename, "template_type": "general", "items": []}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "anthropic/claude-sonnet-4",
                    "max_tokens": 4096,
                    "messages": [
                        {"role": "user", "content": EXTRACTION_PROMPT + truncated},
                    ],
                },
            )
            if response.status_code != 200:
                logger.error("OpenRouter error: %s %s", response.status_code, response.text[:200])
                return {"template_name": filename, "template_type": "general", "items": []}

            data = response.json()
            from packages.common.utils.json_utils import extract_json_text
            raw = data["choices"][0]["message"]["content"]
            result = json.loads(extract_json_text(raw))
            return {
                "template_name": result.get("template_name", filename),
                "template_type": result.get("template_type", "general"),
                "items": result.get("items", []),
            }
    except Exception as e:
        logger.exception("AI parsing failed: %s", e)
        return {"template_name": filename, "template_type": "general", "items": []}


def _extract_text(content: bytes, filename: str) -> str:
    """Extract plain text from PDF or DOCX."""
    lower = filename.lower()

    if lower.endswith(".pdf"):
        return _extract_pdf_text(content)
    elif lower.endswith(".docx"):
        return _extract_docx_text(content)
    elif lower.endswith(".txt") or lower.endswith(".md"):
        return content.decode("utf-8", errors="ignore")
    else:
        return content.decode("utf-8", errors="ignore")


def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF bytes."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        return text
    except ImportError:
        logger.warning("PyMuPDF not installed, trying pdfplumber")
    try:
        import pdfplumber
        pdf = pdfplumber.open(io.BytesIO(content))
        text = ""
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        pdf.close()
        return text
    except ImportError:
        logger.warning("No PDF library available (install PyMuPDF or pdfplumber)")
        return ""


def _extract_docx_text(content: bytes) -> str:
    """Extract text from DOCX bytes."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    except ImportError:
        logger.warning("python-docx not installed, cannot parse DOCX")
        return ""
