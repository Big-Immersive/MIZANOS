"""Multi-column layout renderers (overview+members, metrics row)."""

from typing import Any

from fpdf import FPDF

from apps.api.services.project_report_pdf_sections import (
    AMBER, DARK, GREEN, GREY, NAVY, RED, _heading, _maybe_break,
)
from apps.api.services.report_pdf_service import _sanitize_text


def _col_title(pdf: FPDF, x: float, width: float, text: str) -> None:
    pdf.set_xy(x, pdf.get_y())
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*NAVY)
    pdf.cell(width, 7, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(220, 220, 220)
    y = pdf.get_y()
    pdf.line(x, y, x + width, y)
    pdf.set_xy(x, y + 1)


def add_overview_and_members(pdf: FPDF, product: Any, members: list[dict]) -> None:
    _maybe_break(pdf, 70)
    _heading(pdf, "Project Overview")
    content_w = pdf.w - pdf.l_margin - pdf.r_margin
    col_w = (content_w - 6) / 2
    start_y = pdf.get_y()
    left_x = pdf.l_margin
    right_x = pdf.l_margin + col_w + 6

    # --- Description spans the full content width above the two columns ---
    pdf.set_xy(left_x, start_y)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*DARK)
    if product.description:
        pdf.multi_cell(content_w, 5, _sanitize_text(product.description), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
    fields_start_y = pdf.get_y()

    # --- Left column: product fields ---
    pdf.set_xy(left_x, fields_start_y)
    rows = [
        ("Stage", product.stage or "-"),
        ("Pillar", product.pillar or "-"),
        ("Start Date", product.start_date.strftime("%d %b %Y") if product.start_date else "-"),
        ("End Date", product.end_date.strftime("%d %b %Y") if product.end_date else "-"),
        ("Created", product.created_at.strftime("%d %b %Y") if product.created_at else "-"),
    ]
    for label, value in rows:
        pdf.set_x(left_x)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(28, 6, f"{label}:")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*DARK)
        pdf.cell(col_w - 28, 6, _sanitize_text(str(value))[:40])
        pdf.ln(6)
    left_end = pdf.get_y()

    # --- Right column: members (starts parallel to left fields) ---
    pdf.set_xy(right_x, fields_start_y)
    _col_title(pdf, right_x, col_w, f"Team Members ({len(members)})")
    pdf.set_font("Helvetica", "", 9)
    if not members:
        pdf.set_x(right_x)
        pdf.set_text_color(*GREY)
        pdf.cell(col_w, 5, "No members assigned.")
        pdf.ln(5)
    for m in members:
        pdf.set_x(right_x)
        pdf.set_text_color(*DARK)
        pdf.cell(col_w * 0.5, 5, _sanitize_text(m["name"])[:28])
        pdf.set_text_color(*GREY)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(col_w * 0.5, 5, ", ".join(m["roles"])[:38])
        pdf.ln(5)
        pdf.set_font("Helvetica", "", 9)
    right_end = pdf.get_y()

    pdf.set_xy(pdf.l_margin, max(left_end, right_end) + 4)


def _score_color(score: int) -> tuple[int, int, int]:
    return GREEN if score >= 80 else AMBER if score >= 50 else RED


def _render_code_col(pdf: FPDF, x: float, w: float, scan_pct: float, github: dict | None) -> None:
    _col_title(pdf, x, w, "Code Progress Scan")
    pdf.set_x(x)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*NAVY)
    pdf.cell(w, 6, f"Feature completion: {scan_pct:.0f}%")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*GREY)
    if github:
        for label, val in (
            ("Branch", github.get("branch", "-")),
            ("Total commits", github.get("total_commits", 0)),
            ("Today's commits", github.get("today_commits", 0)),
            ("Contributors", github.get("contributors_count", 0)),
        ):
            pdf.set_x(x)
            pdf.cell(w, 5, f"{label}: {val}"[: int(w / 1.5)])
            pdf.ln(5)


def _render_audit_col(pdf: FPDF, x: float, w: float, audit) -> None:
    _col_title(pdf, x, w, "Latest Audit")
    pdf.set_x(x)
    if not audit:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(w, 6, "No audits yet.")
        pdf.ln(5)
        return
    score = round(audit.overall_score)
    color = _score_color(score)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*color)
    pdf.cell(w, 6, f"Overall: {score} / 100")
    pdf.ln(6)
    pdf.set_x(x)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*GREY)
    pdf.cell(w, 4, audit.run_at.strftime("Run %d %b %Y"))
    pdf.ln(5)
    if isinstance(audit.categories, dict):
        for k, v in audit.categories.items():
            try:
                cs = round(float(v))
            except (TypeError, ValueError):
                continue
            pdf.set_x(x)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*GREY)
            pdf.cell(w * 0.6, 5, f"  {str(k).replace('_', ' ').title()}")
            pdf.set_text_color(*_score_color(cs))
            pdf.cell(w * 0.4, 5, str(cs))
            pdf.ln(5)


def _render_health_col(pdf: FPDF, x: float, w: float, dev_health: dict) -> None:
    _col_title(pdf, x, w, "Development Health")
    pdf.set_x(x)
    overall = int(dev_health.get("overall", 0))
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*_score_color(overall))
    pdf.cell(w, 6, f"Overall: {overall}%")
    pdf.ln(6)
    if dev_health.get("last_scan_at"):
        pdf.set_x(x)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*GREY)
        pdf.cell(w, 4, f"Last scan: {dev_health['last_scan_at']}")
        pdf.ln(5)
    for label, key in (("Spec Alignment", "spec_alignment"), ("Standards", "standards"), ("Code Quality", "code_quality")):
        val = int(dev_health.get(key, 0))
        pdf.set_x(x)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(w * 0.65, 5, f"  {label}")
        pdf.set_text_color(*_score_color(val))
        pdf.cell(w * 0.35, 5, f"{val}%")
        pdf.ln(5)


def add_metrics_columns(pdf: FPDF, scan_pct: float, github: dict | None, audit, dev_health: dict) -> None:
    _maybe_break(pdf, 60)
    content_w = pdf.w - pdf.l_margin - pdf.r_margin
    col_w = (content_w - 8) / 3
    gap = 4
    start_y = pdf.get_y()
    x1 = pdf.l_margin
    x2 = x1 + col_w + gap
    x3 = x2 + col_w + gap

    pdf.set_xy(x1, start_y)
    _render_code_col(pdf, x1, col_w, scan_pct, github)
    y1 = pdf.get_y()

    pdf.set_xy(x2, start_y)
    _render_audit_col(pdf, x2, col_w, audit)
    y2 = pdf.get_y()

    pdf.set_xy(x3, start_y)
    _render_health_col(pdf, x3, col_w, dev_health)
    y3 = pdf.get_y()

    pdf.set_xy(pdf.l_margin, max(y1, y2, y3) + 4)


__all__ = ["add_overview_and_members", "add_metrics_columns"]
