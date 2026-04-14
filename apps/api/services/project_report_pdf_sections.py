"""PDF rendering helpers for the per-project report.

Kept separate from project_report_pdf_service.py so the orchestrator stays under
the 300 LOC limit and each function has a single rendering responsibility.
"""

from datetime import datetime, timezone

from fpdf import FPDF

from apps.api.services.report_pdf_service import _sanitize_text

NAVY = (31, 73, 125)
GREY = (100, 100, 100)
DARK = (0, 0, 0)
GREEN = (0, 130, 0)
AMBER = (200, 130, 0)
RED = (190, 30, 30)


def _heading(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(220, 220, 220)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)


def _maybe_break(pdf: FPDF, needed: int = 25) -> None:
    if pdf.get_y() > pdf.h - needed:
        pdf.add_page()


def add_title(pdf: FPDF, project_name: str) -> None:
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 12, _sanitize_text(project_name), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*GREY)
    pdf.cell(
        0, 7,
        f"Project Report - {datetime.now(timezone.utc).strftime('%d %B %Y')}",
        new_x="LMARGIN", new_y="NEXT",
    )
    pdf.set_draw_color(200, 200, 200)
    pdf.line(pdf.l_margin, pdf.get_y() + 2, pdf.w - pdf.r_margin, pdf.get_y() + 2)
    pdf.ln(8)


def _status_color(status: str) -> tuple[int, int, int]:
    s = (status or "").lower()
    if s in ("done", "live", "fixed", "verified", "complete", "completed"):
        return GREEN
    if s in ("in_progress", "review", "in review", "triaging", "reopened"):
        return AMBER
    if s in ("cancelled", "canceled", "blocked"):
        return RED
    return GREY


def add_project_links(pdf: FPDF, links: list[dict]) -> None:
    if not links:
        return
    _maybe_break(pdf, 20)
    _heading(pdf, f"Project Links ({len(links)})")
    for link in links:
        name = _sanitize_text(link.get("name") or "Link")
        url = link.get("url") or ""
        if not url:
            continue
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*GREY)
        label = f"  {name}: "
        pdf.cell(pdf.get_string_width(label) + 1, 6, label)
        pdf.set_font("Helvetica", "U", 9)
        pdf.set_text_color(5, 99, 193)
        pdf.cell(0, 6, _sanitize_text(url), new_x="LMARGIN", new_y="NEXT", link=url)
    pdf.ln(2)


def add_milestones(pdf: FPDF, milestones: list[dict]) -> None:
    _maybe_break(pdf, 30)
    _heading(pdf, f"Milestones ({len(milestones)})")
    if not milestones:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, "No milestones defined.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        return
    for m in milestones:
        _maybe_break(pdf, 14)
        pct = int(m.get("pct", 0))
        pct_color = GREEN if pct >= 80 else AMBER if pct >= 40 else RED
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*DARK)
        pdf.cell(0, 6, _sanitize_text(m.get("title", "Untitled"))[:80], new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*GREY)
        due_label = m.get("due_date") or "No due date"
        pdf.cell(70, 5, f"  Due: {due_label}")
        pdf.cell(40, 5, f"Tasks: {m.get('done', 0)}/{m.get('total', 0)}")
        pdf.set_text_color(*pct_color)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, f"{pct}% complete", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
    pdf.ln(2)


def add_milestones_with_status_breakdown(pdf: FPDF, milestones: list[dict]) -> None:
    """Like add_milestones, but inlines per-status task counts under each row."""
    _maybe_break(pdf, 30)
    _heading(pdf, f"Milestones ({len(milestones)})")
    if not milestones:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, "No milestones defined.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        return
    for m in milestones:
        _maybe_break(pdf, 18)
        pct = int(m.get("pct", 0))
        pct_color = GREEN if pct >= 80 else AMBER if pct >= 40 else RED
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*DARK)
        pdf.cell(0, 6, _sanitize_text(m.get("title", "Untitled"))[:80], new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*GREY)
        due_label = m.get("due_date") or "No due date"
        pdf.cell(70, 5, f"  Due: {due_label}")
        pdf.cell(40, 5, f"Tasks: {m.get('done', 0)}/{m.get('total', 0)}")
        pdf.set_text_color(*pct_color)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, f"{pct}% complete", new_x="LMARGIN", new_y="NEXT")
        breakdown = m.get("status_breakdown") or {}
        if breakdown:
            pdf.set_x(pdf.l_margin)
            pdf.set_font("Helvetica", "", 8)
            for status, count in sorted(breakdown.items()):
                if not count:
                    continue
                label = status.replace("_", " ").title()
                pdf.set_text_color(*GREY)
                pdf.cell(pdf.get_string_width("  "), 5, "  ")
                pdf.set_text_color(*_status_color(status))
                pdf.cell(pdf.get_string_width(f"{label}: {count}") + 4, 5, f"{label}: {count}")
            pdf.ln(5)
        pdf.ln(1)
    pdf.ln(2)


def add_status_summary(pdf: FPDF, label: str, counts: dict[str, int], total: int) -> None:
    _maybe_break(pdf, 30)
    _heading(pdf, f"{label} ({total} total)")
    if total == 0:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, f"No {label.lower()} found.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        return
    pdf.set_font("Helvetica", "", 9)
    for status, count in counts.items():
        pdf.set_text_color(*GREY)
        pdf.cell(45, 6, f"  {status.replace('_', ' ').title()}:")
        pdf.set_text_color(*_status_color(status))
        pdf.cell(0, 6, str(count), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def add_global_cover(pdf: FPDF, products: list) -> None:
    """Cover page for the global multi-project report."""
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 14, "Mizan OS - Global Project Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(*GREY)
    pdf.cell(
        0, 8,
        datetime.now(timezone.utc).strftime("Generated %d %B %Y"),
        new_x="LMARGIN", new_y="NEXT",
    )
    pdf.ln(4)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(8)

    _heading(pdf, f"Portfolio Summary ({len(products)} projects)")
    stage_counts: dict[str, int] = {}
    for p in products:
        stage_counts[p.stage or "Unknown"] = stage_counts.get(p.stage or "Unknown", 0) + 1
    pdf.set_font("Helvetica", "", 10)
    for stage, count in sorted(stage_counts.items()):
        pdf.set_text_color(*GREY)
        pdf.cell(60, 6, f"  {stage}:")
        pdf.set_text_color(*DARK)
        pdf.cell(0, 6, str(count), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)


__all__ = [
    "add_title", "add_milestones", "add_milestones_with_status_breakdown",
    "add_project_links", "add_status_summary", "add_global_cover",
    "AMBER", "DARK", "GREEN", "GREY", "NAVY", "RED",
    "_heading", "_maybe_break", "_status_color",
]
