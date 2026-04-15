"""PDF rendering + scoring helpers for Development Health and AI Insights."""

from fpdf import FPDF

from apps.api.services.project_report_pdf_sections import (
    AMBER, DARK, GREEN, GREY, NAVY, RED, _heading, _maybe_break,
)
from apps.api.services.report_pdf_service import _sanitize_text


def compute_dev_health(scan_result, audit, analysis) -> dict:
    """Compute Development Health from real scan + audit data.

    - Spec Alignment: % of spec tasks verified by the latest code scan
      (scan_result.gap_analysis.progress_pct or verified/total_tasks).
    - Code Quality: weighted blend of avg task evidence confidence (60%)
      and fraction of tasks with any artifact found (40%), from
      scan_result.functional_inventory.
    - Standards: latest audit's `style` category score. No fake heuristic.
    - Overall: weighted average of whichever of the three have data.

    If a component has no data it is reported as None; callers render
    "Not scanned" or "Run audit" instead of a misleading 0%.
    """
    ga = (scan_result.gap_analysis if scan_result and scan_result.gap_analysis else None) or {}
    inventory = (scan_result.functional_inventory if scan_result and scan_result.functional_inventory else None) or []
    has_scan = bool(ga) or bool(inventory)

    # Spec alignment — requires a scan with gap analysis
    spec: int | None = None
    if isinstance(ga, dict):
        if isinstance(ga.get("progress_pct"), (int, float)):
            spec = round(ga["progress_pct"])
        elif ga.get("total_tasks") and isinstance(ga.get("verified"), (int, float)):
            spec = round((ga["verified"] / ga["total_tasks"]) * 100)

    # Code quality — requires inventory from the scan
    quality: int | None = None
    if isinstance(inventory, list) and inventory:
        total = len(inventory)
        avg_conf = sum(float(e.get("confidence", 0) or 0) for e in inventory if isinstance(e, dict)) / total
        with_artifacts = sum(1 for e in inventory if isinstance(e, dict) and e.get("artifacts_found"))
        quality = round(avg_conf * 60 + (with_artifacts / total) * 40)

    # Standards — latest audit's Code Quality score from the real audit
    # tools (lizard / jscpd / ruff / bandit). Returns None when no audit
    # has been run yet — callers render "N/A".
    standards: int | None = None
    has_audit = False
    if audit and isinstance(getattr(audit, "categories", None), dict):
        score = audit.categories.get("code_quality")
        if isinstance(score, (int, float)):
            standards = round(float(score))
            has_audit = True

    # Overall — weighted average across whichever components have data
    weights = {"spec_alignment": (spec, 0.4), "code_quality": (quality, 0.35), "standards": (standards, 0.25)}
    present = [(v, w) for v, w in weights.values() if v is not None]
    if present:
        total_weight = sum(w for _, w in present)
        overall: int | None = round(sum(v * w for v, w in present) / total_weight)
    else:
        overall = None

    last_scan_at = None
    if scan_result and getattr(scan_result, "created_at", None):
        last_scan_at = scan_result.created_at.strftime("%d %b %Y")
    return {
        "spec_alignment": spec,
        "code_quality": quality,
        "standards": standards,
        "overall": overall,
        "spec_label": "tasks verified" if has_scan else "not scanned",
        "quality_label": "evidence quality" if has_scan else "not scanned",
        "standards_label": "style (audit)" if has_audit else "run audit",
        "last_scan_at": last_scan_at,
    }


def _fmt_score(value) -> tuple[str, tuple[int, int, int]]:
    if value is None:
        return "N/A", GREY
    v = int(value)
    color = GREEN if v >= 80 else AMBER if v >= 50 else RED
    return f"{v}%", color


def add_development_health(pdf: FPDF, scores: dict) -> None:
    _maybe_break(pdf, 40)
    _heading(pdf, "Development Health")
    overall_text, overall_color = _fmt_score(scores.get("overall"))
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*overall_color)
    pdf.cell(0, 7, f"Overall Health Score: {overall_text}", new_x="LMARGIN", new_y="NEXT")
    if scores.get("last_scan_at"):
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*GREY)
        pdf.cell(0, 5, f"Last scan: {scores['last_scan_at']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    rows = [
        ("Spec Alignment", scores.get("spec_alignment"), scores.get("spec_label", "tasks verified")),
        ("Standards", scores.get("standards"), scores.get("standards_label", "style (audit)")),
        ("Code Quality", scores.get("code_quality"), scores.get("quality_label", "evidence quality")),
    ]
    for label, value, suffix in rows:
        text, row_color = _fmt_score(value)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*GREY)
        pdf.cell(45, 6, f"  {label}:")
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*row_color)
        pdf.cell(20, 6, text)
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
