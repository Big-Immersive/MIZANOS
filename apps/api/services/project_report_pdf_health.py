"""PDF rendering + scoring helpers for Development Health and AI Insights."""

from fpdf import FPDF

from apps.api.services.project_report_pdf_sections import (
    AMBER, DARK, GREEN, GREY, NAVY, RED, _heading, _maybe_break,
)
from apps.api.services.report_pdf_service import _sanitize_text


def compute_dev_health(scan_result, audit, analysis) -> dict:
    """Mirror the frontend DevelopmentHealthSection score calculation."""
    ga = (scan_result.gap_analysis if scan_result and scan_result.gap_analysis else None) or {}
    inventory = (scan_result.functional_inventory if scan_result and scan_result.functional_inventory else None) or []
    has_scan = bool(ga)

    spec = 0
    if isinstance(ga, dict):
        if isinstance(ga.get("progress_pct"), (int, float)):
            spec = round(ga["progress_pct"])
        elif ga.get("total_tasks") and isinstance(ga.get("verified"), (int, float)):
            spec = round((ga["verified"] / ga["total_tasks"]) * 100)
    if spec == 0 and analysis and getattr(analysis, "overall_score", None):
        spec = round(analysis.overall_score)

    quality = 0
    if isinstance(inventory, list) and inventory:
        total = len(inventory)
        avg_conf = sum(float(e.get("confidence", 0) or 0) for e in inventory if isinstance(e, dict)) / total
        with_artifacts = sum(1 for e in inventory if isinstance(e, dict) and e.get("artifacts_found"))
        quality = round(avg_conf * 60 + (with_artifacts / total) * 40)
    if quality == 0 and audit and getattr(audit, "overall_score", None):
        quality = round(audit.overall_score)

    tech_stack = (analysis.tech_stack if analysis and isinstance(analysis.tech_stack, dict) else {}) or {}
    score = 0
    checks = 5
    if tech_stack.get("description"):
        score += 1
    try:
        if int(tech_stack.get("contributors", 0) or 0) > 1:
            score += 1
    except (TypeError, ValueError):
        pass
    file_count = (scan_result.file_count if scan_result and scan_result.file_count else 0) or 0
    if file_count > 10:
        score += 1
    if isinstance(ga, dict) and ga.get("total_tasks"):
        no_ev_ratio = float(ga.get("no_evidence", 0) or 0) / float(ga["total_tasks"])
        if no_ev_ratio < 0.3:
            score += 1
        if (ga.get("verified") or 0) > 0:
            score += 1
    standards = round((score / checks) * 100)

    overall = round(spec * 0.4 + quality * 0.35 + standards * 0.25)
    last_scan_at = None
    if scan_result and getattr(scan_result, "created_at", None):
        last_scan_at = scan_result.created_at.strftime("%d %b %Y")
    return {
        "spec_alignment": spec,
        "code_quality": quality,
        "standards": standards,
        "overall": overall,
        "spec_label": "tasks verified" if has_scan else "from analysis",
        "quality_label": "evidence quality" if has_scan else "audit score",
        "last_scan_at": last_scan_at,
    }


def add_development_health(pdf: FPDF, scores: dict) -> None:
    _maybe_break(pdf, 40)
    _heading(pdf, "Development Health")
    overall = int(scores.get("overall", 0))
    color = GREEN if overall >= 80 else AMBER if overall >= 50 else RED
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*color)
    pdf.cell(0, 7, f"Overall Health Score: {overall}%", new_x="LMARGIN", new_y="NEXT")
    if scores.get("last_scan_at"):
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 5, f"Last scan: {scores['last_scan_at']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    rows = [
        ("Spec Alignment", int(scores.get("spec_alignment", 0)), scores.get("spec_label", "tasks verified")),
        ("Standards", int(scores.get("standards", 0)), "compliance"),
        ("Code Quality", int(scores.get("code_quality", 0)), scores.get("quality_label", "evidence quality")),
    ]
    for label, value, suffix in rows:
        row_color = GREEN if value >= 80 else AMBER if value >= 50 else RED
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(45, 6, f"  {label}:")
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*row_color)
        pdf.cell(20, 6, f"{value}%")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, suffix, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def add_ai_insights(pdf: FPDF, ai_analysis: dict | None) -> None:
    _maybe_break(pdf, 30)
    _heading(pdf, "AI Insights")
    if not ai_analysis:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 6, "No AI analysis available. Trigger an analysis from the Reports page.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        return
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*DARK)
    if ai_analysis.get("health_assessment"):
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, _sanitize_text(ai_analysis["health_assessment"]), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
    for section_key, section_label in (("risk_factors", "Risk Factors"), ("recommendations", "Recommendations")):
        items = ai_analysis.get(section_key) or []
        if not items:
            continue
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, section_label + ":", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*DARK)
        for it in items:
            _maybe_break(pdf, 10)
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(0, 5, f"  - {_sanitize_text(str(it))}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
    dev_summary = ai_analysis.get("dev_contribution_summary")
    if dev_summary:
        _maybe_break(pdf, 20)
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, "Development Progress:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(0, 5, _sanitize_text(str(dev_summary)), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)


__all__ = ["add_development_health", "add_ai_insights", "compute_dev_health"]
