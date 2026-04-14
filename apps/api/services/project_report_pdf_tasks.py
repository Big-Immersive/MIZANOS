"""Task-list PDF rendering helpers (flat list + grouped-by-milestone)."""

from fpdf import FPDF

from apps.api.services.project_report_pdf_sections import (
    DARK, GREY, NAVY, _heading, _maybe_break, _status_color,
)
from apps.api.services.report_pdf_service import _sanitize_text


def _render_item(pdf: FPDF, item: dict) -> None:
    _maybe_break(pdf, 18)
    pdf.set_text_color(*DARK)
    pdf.set_font("Helvetica", "B", 9)
    title = _sanitize_text(item.get("title") or "(untitled)")[:90]
    raw_status = item.get("status") or "unknown"
    status = raw_status.replace("_", " ").title()
    pdf.cell(0, 5, f"- {title}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*GREY)
    label_w = pdf.get_string_width("  Status: ")
    pdf.cell(label_w, 4, "  Status: ")
    pdf.set_text_color(*_status_color(raw_status))
    pdf.cell(0, 4, status, new_x="LMARGIN", new_y="NEXT")
    desc = item.get("description")
    if desc:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(70, 70, 70)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, f"  {_sanitize_text(desc)[:400]}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)


def add_item_list(pdf: FPDF, label: str, items: list[dict], limit: int = 50) -> None:
    if not items:
        return
    _maybe_break(pdf, 30)
    _heading(pdf, f"{label} Detail")
    for item in items[:limit]:
        _render_item(pdf, item)
    if len(items) > limit:
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 5, f"  ... and {len(items) - limit} more.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def add_tasks_by_milestone(pdf: FPDF, grouped: list[dict], limit: int = 80) -> None:
    total = sum(len(g.get("tasks", [])) for g in grouped)
    if total == 0:
        return
    _maybe_break(pdf, 30)
    _heading(pdf, f"Task Detail ({total} total)")
    rendered = 0
    for group in grouped:
        tasks = group.get("tasks", [])
        if not tasks:
            continue
        _maybe_break(pdf, 14)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*NAVY)
        title = _sanitize_text(group.get("title", "Ungrouped"))[:80]
        pdf.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(230, 230, 230)
        pdf.line(pdf.l_margin + 2, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(1)
        for t in tasks:
            if rendered >= limit:
                break
            _render_item(pdf, t)
            rendered += 1
        pdf.ln(1)
        if rendered >= limit:
            break
    if total > limit:
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 5, f"  ... and {total - limit} more task(s).", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


__all__ = ["add_item_list", "add_tasks_by_milestone"]
