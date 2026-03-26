"""Generate downloadable PDF reports matching the daily briefing format."""

import io
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fpdf import FPDF
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.services.llm_config import get_llm_config
from apps.api.services.report_service import ReportService

logger = logging.getLogger(__name__)


class _ReportPDF(FPDF):
    """Custom FPDF subclass with report styling helpers."""

    def header(self) -> None:
        pass

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")


class ReportPDFService:
    """Generate a PDF report for selected projects."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def generate(self, product_ids: list[UUID]) -> io.BytesIO:
        """Build a PDF report for the given product IDs."""
        svc = ReportService(self.session)
        summary = await svc.get_summary()

        projects = [p for p in summary["projects"] if p["product_id"] in product_ids]
        if not projects:
            projects = summary["projects"]

        ai_summary = await self._generate_executive_summary(projects)
        project_updates = await self._generate_project_updates(projects)

        pdf = _ReportPDF()
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=20)
        pdf.add_page()

        self._add_title(pdf)
        self._add_executive_summary(pdf, ai_summary)
        self._add_project_updates(pdf, projects, project_updates)
        self._add_portfolio_table(pdf, projects)

        buf = io.BytesIO()
        pdf.output(buf)
        buf.seek(0)
        return buf

    # ------------------------------------------------------------------
    # PDF sections
    # ------------------------------------------------------------------

    @staticmethod
    def _add_title(pdf: _ReportPDF) -> None:
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 12, "PROJECT STATUS UPDATE", new_x="LMARGIN", new_y="NEXT")

        date_str = datetime.now(timezone.utc).strftime("Daily Briefing -- %d %B %Y")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 8, date_str, new_x="LMARGIN", new_y="NEXT")

        pdf.set_draw_color(200, 200, 200)
        pdf.line(pdf.l_margin, pdf.get_y() + 2, pdf.w - pdf.r_margin, pdf.get_y() + 2)
        pdf.ln(8)

    @staticmethod
    def _add_executive_summary(pdf: _ReportPDF, text: str) -> None:
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(31, 73, 125)
        pdf.cell(0, 10, "Executive Summary", new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(0, 5, _safe(text))
        pdf.ln(6)

    @staticmethod
    def _add_project_updates(
        pdf: _ReportPDF, projects: list[dict], updates: dict[str, list[str]],
    ) -> None:
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(31, 73, 125)
        pdf.cell(0, 10, "Project Updates", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

        for proj in projects:
            pid = str(proj["product_id"])
            name = proj["product_name"]
            stage = (proj.get("stage") or "N/A").upper()
            pm = proj.get("pm_name") or "--"
            dev = proj.get("dev_name") or "--"

            # Check if we need a page break for the project block
            if pdf.get_y() > pdf.h - 50:
                pdf.add_page()

            # Project name
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(0, 0, 0)
            x_start = pdf.get_x()
            pdf.cell(pdf.get_string_width(_safe(name)) + 2, 7, _safe(name))

            # Stage badge
            pdf.set_font("Helvetica", "B", 9)
            _stage_color(pdf, stage)
            pdf.cell(pdf.get_string_width(stage) + 4, 7, stage)

            # PM and Dev
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(100, 100, 100)
            pdf.cell(0, 7, f"  PM: {_safe(pm)}  Dev: {_safe(dev)}", new_x="LMARGIN", new_y="NEXT")

            # Bullet points
            bullets = updates.get(pid, [])
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(0, 0, 0)
            for bullet in bullets:
                pdf.set_x(pdf.l_margin + 6)
                pdf.cell(4, 5, "-")
                pdf.multi_cell(0, 5, f"  {_safe(bullet)}")

            # Explore links
            live_url = proj.get("live_url")
            dash_url = proj.get("dashboard_url")
            if live_url or dash_url:
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(60, 60, 60)
                pdf.set_x(pdf.l_margin + 4)
                pdf.cell(0, 6, "EXPLORE THIS PRODUCT:", new_x="LMARGIN", new_y="NEXT")
                pdf.set_font("Helvetica", "", 9)
                if live_url:
                    pdf.set_x(pdf.l_margin + 8)
                    pdf.set_text_color(60, 60, 60)
                    pdf.cell(pdf.get_string_width("Live: ") + 1, 5, "Live: ")
                    pdf.set_text_color(5, 99, 193)
                    pdf.cell(0, 5, _shorten(live_url), new_x="LMARGIN", new_y="NEXT", link=live_url)
                if dash_url:
                    pdf.set_x(pdf.l_margin + 8)
                    pdf.set_text_color(60, 60, 60)
                    pdf.cell(pdf.get_string_width("Dashboard: ") + 1, 5, "Dashboard: ")
                    pdf.set_text_color(5, 99, 193)
                    pdf.cell(0, 5, _shorten(dash_url), new_x="LMARGIN", new_y="NEXT", link=dash_url)

            pdf.ln(6)

    @staticmethod
    def _add_portfolio_table(pdf: _ReportPDF, projects: list[dict]) -> None:
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()

        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(31, 73, 125)
        pdf.cell(0, 10, "Portfolio Directory", new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(
            0, 6,
            "Quick reference for all projects -- status, live links, and dashboard/dev links.",
            new_x="LMARGIN", new_y="NEXT",
        )
        pdf.ln(3)

        headers = ["Project", "Status", "Dev", "Tasks", "Live Link", "Dashboard / Dev"]
        col_w = [32, 22, 28, 16, 46, 46]
        row_h = 7

        # Header row
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_fill_color(220, 230, 241)
        pdf.set_text_color(0, 0, 0)
        for i, h in enumerate(headers):
            pdf.cell(col_w[i], row_h, h, border=1, fill=True)
        pdf.ln(row_h)

        # Data rows
        pdf.set_font("Helvetica", "", 8)
        for idx, proj in enumerate(projects):
            fill = idx % 2 == 1
            if fill:
                pdf.set_fill_color(245, 245, 245)

            if pdf.get_y() > pdf.h - 20:
                pdf.add_page()
                # Re-add header
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_fill_color(220, 230, 241)
                for i, h in enumerate(headers):
                    pdf.cell(col_w[i], row_h, h, border=1, fill=True)
                pdf.ln(row_h)
                pdf.set_font("Helvetica", "", 8)

            pdf.set_text_color(0, 0, 0)
            pdf.cell(col_w[0], row_h, _safe(proj["product_name"][:18]), border=1, fill=fill)
            pdf.cell(col_w[1], row_h, _safe((proj.get("stage") or "--")[:12]), border=1, fill=fill)
            pdf.cell(col_w[2], row_h, _safe((proj.get("dev_name") or "--")[:16]), border=1, fill=fill)
            pdf.cell(col_w[3], row_h, f"{proj['completed_tasks']}/{proj['total_tasks']}", border=1, fill=fill)

            # Live link
            live_url = proj.get("live_url")
            if live_url:
                x = pdf.get_x()
                y = pdf.get_y()
                pdf.set_text_color(5, 99, 193)
                pdf.cell(col_w[4], row_h, _shorten(live_url)[:26], border=1, fill=fill, link=live_url)
            else:
                pdf.cell(col_w[4], row_h, "--", border=1, fill=fill)

            # Dashboard link
            dash_url = proj.get("dashboard_url")
            if dash_url:
                pdf.set_text_color(5, 99, 193)
                pdf.cell(col_w[5], row_h, _shorten(dash_url)[:26], border=1, fill=fill, link=dash_url)
            else:
                pdf.set_text_color(0, 0, 0)
                pdf.cell(col_w[5], row_h, "--", border=1, fill=fill)

            pdf.ln(row_h)

    # ------------------------------------------------------------------
    # AI generation (reuses same prompts as docx service)
    # ------------------------------------------------------------------

    async def _generate_executive_summary(self, projects: list[dict]) -> str:
        lines = []
        for p in projects:
            lines.append(
                f"- {p['product_name']} ({p.get('stage', 'N/A')}): "
                f"{p['completed_tasks']}/{p['total_tasks']} tasks done, "
                f"{p.get('total_commits', 0)} commits"
            )
        context = "\n".join(lines)
        prompt = (
            "Write a concise executive summary (1 paragraph, 4-6 sentences) for a "
            "daily project status briefing. Summarize the key highlights across these "
            "projects. Be specific about project names and achievements. "
            "No markdown, no bullet points — just flowing prose.\n\n"
            f"Projects:\n{context}"
        )
        return await self._call_llm(prompt)

    async def _generate_project_updates(
        self, projects: list[dict],
    ) -> dict[str, list[str]]:
        context = json.dumps(
            [
                {
                    "id": str(p["product_id"]),
                    "name": p["product_name"],
                    "stage": p.get("stage"),
                    "tasks_done": p["completed_tasks"],
                    "total_tasks": p["total_tasks"],
                    "in_progress": p["in_progress_tasks"],
                    "commits": p.get("total_commits", 0),
                }
                for p in projects
            ],
            indent=2,
        )
        prompt = (
            "For each project, generate 3-4 concise bullet points summarizing "
            "current status and recent progress. Return ONLY valid JSON with format:\n"
            '{"<product_id>": ["bullet 1", "bullet 2", ...], ...}\n'
            "No markdown fences. No explanation.\n\n"
            f"Projects:\n{context}"
        )
        raw = await self._call_llm(prompt)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Failed to parse project updates JSON")
            return {}

    async def _call_llm(self, prompt: str) -> str:
        import openai
        config = await get_llm_config(self.session)
        client = openai.AsyncOpenAI(api_key=config.api_key, base_url=config.base_url)
        response = await client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""


def _shorten(url: str) -> str:
    """Remove protocol prefix for display."""
    return url.replace("https://", "").replace("http://", "").rstrip("/")


def _safe(text: str) -> str:
    """Replace Unicode chars unsupported by Helvetica with ASCII equivalents."""
    return (
        text.replace("\u2014", "--")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2022", "-")
        .replace("\u2026", "...")
        .replace("\u00a0", " ")
    )


def _stage_color(pdf: _ReportPDF, stage: str) -> None:
    """Set text color based on stage."""
    s = stage.lower()
    if s in ("live", "production", "complete"):
        pdf.set_text_color(0, 128, 0)
    elif s in ("ready for gtm", "deployment"):
        pdf.set_text_color(0, 100, 0)
    elif s in ("qa", "testing"):
        pdf.set_text_color(200, 150, 0)
    elif s in ("development", "in dev"):
        pdf.set_text_color(31, 73, 125)
    elif s == "intake":
        pdf.set_text_color(200, 130, 0)
    else:
        pdf.set_text_color(100, 100, 100)
