"""PDF rendering helpers for the per-project report.

Kept separate from project_report_pdf_service.py so the orchestrator stays under
the 300 LOC limit and each function has a single rendering responsibility.
"""

from datetime import datetime, timezone
from typing import Any

from fpdf import FPDF

from apps.api.services.report_pdf_service import _sanitize_text, _shorten

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


def add_overview(pdf: FPDF, product: Any) -> None:
    _heading(pdf, "Project Overview")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*DARK)
    if product.description:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, _sanitize_text(product.description), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    rows = [
        ("Stage", product.stage or "-"),
        ("Pillar", product.pillar or "-"),
        ("Start Date", product.start_date.strftime("%d %b %Y") if product.start_date else "-"),
        ("End Date", product.end_date.strftime("%d %b %Y") if product.end_date else "-"),
        ("Created", product.created_at.strftime("%d %b %Y") if product.created_at else "-"),
    ]
    for label, value in rows:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(35, 6, f"{label}:")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*DARK)
        pdf.cell(0, 6, _sanitize_text(str(value)), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)


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
        pdf.set_font("Helvetica", "BU", 10)
        pdf.set_text_color(5, 99, 193)
        pdf.cell(0, 6, name, new_x="LMARGIN", new_y="NEXT", link=url)
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


def add_stage_progress(pdf: FPDF, current_stage: str | None) -> None:
    _heading(pdf, "Stage Progress")
    track = ["Intake", "Development", "QA", "Security", "Dev Ready", "Soft Launch", "Launched"]
    idx = track.index(current_stage) if current_stage in track else -1
    pdf.set_font("Helvetica", "", 9)
    for i, s in enumerate(track):
        if i < idx:
            marker, color = "[x]", GREEN
        elif i == idx:
            marker, color = "[>]", NAVY
        else:
            marker, color = "[ ]", GREY
        pdf.set_text_color(*color)
        pdf.cell(0, 5, f"  {marker} {s}{' (current)' if i == idx else ''}", new_x="LMARGIN", new_y="NEXT")
    if current_stage == "On Hold":
        pdf.set_text_color(*AMBER)
        pdf.cell(0, 6, "  Project is currently On Hold.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)


def add_members(pdf: FPDF, members: list[dict]) -> None:
    _maybe_break(pdf, 30)
    _heading(pdf, f"Team Members ({len(members)})")
    if not members:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, "No members assigned.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        return
    pdf.set_font("Helvetica", "", 9)
    for m in members:
        _maybe_break(pdf, 12)
        pdf.set_text_color(*DARK)
        pdf.cell(80, 6, _sanitize_text(m["name"])[:40])
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, ", ".join(m["roles"]), new_x="LMARGIN", new_y="NEXT")
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
    for status, count in sorted(counts.items()):
        pdf.set_text_color(*GREY)
        pdf.cell(45, 6, f"  {status.replace('_', ' ').title()}:")
        pdf.set_text_color(*DARK)
        pdf.cell(0, 6, str(count), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def add_audit_section(pdf: FPDF, audit) -> None:
    _maybe_break(pdf, 35)
    _heading(pdf, "Latest Audit")
    if not audit:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, "No audits run for this project yet.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        return
    score = round(audit.overall_score)
    color = GREEN if score >= 80 else AMBER if score >= 60 else RED
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*color)
    pdf.cell(0, 7, f"Overall Score: {score} / 100", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*GREY)
    pdf.cell(0, 5, f"Run on {audit.run_at.strftime('%d %b %Y, %H:%M')}", new_x="LMARGIN", new_y="NEXT")
    if isinstance(audit.categories, dict) and audit.categories:
        pdf.ln(1)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 5, "Category breakdown:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for k, v in audit.categories.items():
            try:
                cat_score = round(float(v))
            except (TypeError, ValueError):
                continue
            pdf.set_text_color(*GREY)
            pdf.cell(60, 5, f"  {str(k).replace('_', ' ').title()}:")
            cat_color = GREEN if cat_score >= 80 else AMBER if cat_score >= 60 else RED
            pdf.set_text_color(*cat_color)
            pdf.cell(0, 5, str(cat_score), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def add_code_progress(pdf: FPDF, scan_pct: float, github: dict | None) -> None:
    _maybe_break(pdf, 25)
    _heading(pdf, "Code Progress Scan")
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 7, f"Feature completion: {scan_pct:.0f}%", new_x="LMARGIN", new_y="NEXT")
    if github:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 5, f"Branch: {github.get('branch', '-')}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 5, f"Total commits: {github.get('total_commits', 0)}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 5, f"Today's commits: {github.get('today_commits', 0)}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 5, f"Contributors: {github.get('contributors_count', 0)}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


__all__ = [
    "add_title", "add_overview", "add_milestones", "add_project_links",
    "add_stage_progress", "add_members", "add_status_summary", "add_audit_section",
    "add_code_progress",
    "AMBER", "DARK", "GREEN", "GREY", "NAVY", "RED",
    "_heading", "_maybe_break", "_status_color",
]
