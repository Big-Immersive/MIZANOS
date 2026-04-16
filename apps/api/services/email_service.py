"""Email service using Resend SDK."""

import base64
import logging

from apps.api.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Sends transactional emails via Resend."""

    @staticmethod
    async def send_invitation_email(
        to_email: str,
        full_name: str,
        activation_link: str,
        inviter_name: str,
    ) -> bool:
        """Send an invitation email with an activation link. Returns True on success."""
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping invitation email to %s", to_email)
            return False

        import resend

        resend.api_key = settings.resend_api_key

        html = (
            f"<h2>You've been invited to Mizan</h2>"
            f"<p>Hi {full_name},</p>"
            f"<p>{inviter_name} has invited you to join the team on Mizan.</p>"
            f"<p>Click the button below to activate your account. "
            f"This link expires in 7 days.</p>"
            f'<p><a href="{activation_link}" '
            f'style="display:inline-block;padding:12px 24px;'
            f"background:#2563eb;color:#fff;border-radius:6px;"
            f'text-decoration:none;font-weight:600">'
            f"Activate Account</a></p>"
            f"<p>Or copy this link: {activation_link}</p>"
        )

        try:
            resend.Emails.send({
                "from": settings.email_from,
                "to": [to_email],
                "subject": f"{inviter_name} invited you to Mizan",
                "html": html,
            })
            return True
        except Exception:
            logger.exception("Failed to send invitation email to %s", to_email)
            return False

    @staticmethod
    async def send_password_reset_email(
        to_email: str,
        full_name: str,
        reset_link: str,
    ) -> bool:
        """Send a password reset email. Returns True on success."""
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping reset email to %s", to_email)
            return False

        import resend

        resend.api_key = settings.resend_api_key

        html = (
            f"<h2>Reset Your Password</h2>"
            f"<p>Hi {full_name},</p>"
            f"<p>We received a request to reset your Mizan password.</p>"
            f"<p>Click the button below to set a new password. "
            f"This link expires in 1 hour.</p>"
            f'<p><a href="{reset_link}" '
            f'style="display:inline-block;padding:12px 24px;'
            f"background:#2563eb;color:#fff;border-radius:6px;"
            f'text-decoration:none;font-weight:600">'
            f"Reset Password</a></p>"
            f"<p>Or copy this link: {reset_link}</p>"
            f"<p>If you didn't request this, you can safely ignore this email.</p>"
        )

        try:
            resend.Emails.send({
                "from": settings.email_from,
                "to": [to_email],
                "subject": "Reset your Mizan password",
                "html": html,
            })
            return True
        except Exception:
            logger.exception("Failed to send password reset email to %s", to_email)
            return False

    @staticmethod
    async def send_task_assignment_email(
        to_email: str,
        full_name: str,
        task_title: str,
        product_name: str,
        task_url: str,
    ) -> bool:
        """Send a task assignment notification email. Returns True on success."""
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping task assignment email to %s", to_email)
            return False

        import resend

        resend.api_key = settings.resend_api_key

        html = (
            f"<h2>Task Assigned</h2>"
            f"<p>Hi {full_name},</p>"
            f"<p>You've been assigned to <strong>{task_title}</strong> "
            f"in <strong>{product_name}</strong>.</p>"
            f'<p><a href="{task_url}" '
            f'style="display:inline-block;padding:12px 24px;'
            f"background:#2563eb;color:#fff;border-radius:6px;"
            f'text-decoration:none;font-weight:600">'
            f"View Task</a></p>"
        )

        try:
            resend.Emails.send({
                "from": settings.email_from,
                "to": [to_email],
                "subject": f"Task assigned: {task_title}",
                "html": html,
            })
            return True
        except Exception:
            logger.exception("Failed to send task assignment email to %s", to_email)
            return False

    @staticmethod
    async def send_bulk_task_assignment_email(
        to_email: str,
        full_name: str,
        tasks: list[dict],
    ) -> bool:
        """Send a consolidated task assignment email. Returns True on success."""
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping bulk assignment email to %s", to_email)
            return False

        import resend

        resend.api_key = settings.resend_api_key

        rows = "".join(
            f"<tr><td style='padding:8px;border-bottom:1px solid #e5e7eb'>{t['title']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'>{t['product_name']}</td></tr>"
            for t in tasks
        )
        html = (
            f"<h2>Tasks Assigned</h2>"
            f"<p>Hi {full_name},</p>"
            f"<p>You've been assigned to {len(tasks)} task{'s' if len(tasks) != 1 else ''}:</p>"
            f"<table style='border-collapse:collapse;width:100%'>"
            f"<tr><th style='padding:8px;text-align:left;border-bottom:2px solid #e5e7eb'>Task</th>"
            f"<th style='padding:8px;text-align:left;border-bottom:2px solid #e5e7eb'>Project</th></tr>"
            f"{rows}</table>"
        )

        try:
            resend.Emails.send({
                "from": settings.email_from,
                "to": [to_email],
                "subject": f"You've been assigned {len(tasks)} tasks",
                "html": html,
            })
            return True
        except Exception:
            logger.exception("Failed to send bulk assignment email to %s", to_email)
            return False

    @staticmethod
    async def send_comment_mention_email(
        to_email: str,
        full_name: str,
        author_name: str,
        task_title: str,
        comment_preview: str,
        task_url: str,
    ) -> bool:
        """Send a comment @mention notification email. Returns True on success."""
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping mention email to %s", to_email)
            return False

        import resend

        resend.api_key = settings.resend_api_key

        html = (
            f"<h2>You were mentioned in a comment</h2>"
            f"<p>Hi {full_name},</p>"
            f"<p><strong>{author_name}</strong> mentioned you in a comment on "
            f"<strong>{task_title}</strong>:</p>"
            f"<blockquote style='border-left:3px solid #e5e7eb;padding:8px 12px;"
            f"margin:12px 0;color:#6b7280'>{comment_preview}</blockquote>"
            f'<p><a href="{task_url}" '
            f'style="display:inline-block;padding:12px 24px;'
            f"background:#2563eb;color:#fff;border-radius:6px;"
            f'text-decoration:none;font-weight:600">'
            f"View Task</a></p>"
        )

        try:
            resend.Emails.send({
                "from": settings.email_from,
                "to": [to_email],
                "subject": f"{author_name} mentioned you in a comment",
                "html": html,
            })
            return True
        except Exception:
            logger.exception("Failed to send mention email to %s", to_email)
            return False

    @staticmethod
    async def send_global_report_email(
        to_emails: list[str],
        pdf_bytes: bytes,
        filename: str,
        project_count: int,
        warnings: list[str] | None = None,
    ) -> bool:
        """Send the nightly global multi-project PDF report as an attachment."""
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping global report email")
            return False
        if not to_emails:
            logger.warning("No recipients configured — skipping global report email")
            return False

        import resend

        resend.api_key = settings.resend_api_key

        warning_html = ""
        if warnings:
            items = "".join(f"<li>{w}</li>" for w in warnings)
            warning_html = (
                "<p style='color:#b45309'><strong>Notes:</strong></p>"
                f"<ul style='color:#6b7280'>{items}</ul>"
            )

        html = (
            "<h2>Mizan Daily Project Report</h2>"
            f"<p>Attached is today's automated multi-project report covering "
            f"<strong>{project_count}</strong> active project(s).</p>"
            "<p>Each project section includes the latest code-evidence scan, "
            "static-analysis audit (security / dependencies / code quality / hygiene), "
            "development-health sub-scores, milestones, and AI analysis.</p>"
            f"{warning_html}"
            "<p style='color:#9ca3af;font-size:12px;margin-top:20px'>"
            "Sent automatically by Mizan OS. Reply-to is not monitored."
            "</p>"
        )

        attachment = {
            "filename": filename,
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
        }

        try:
            resend.Emails.send({
                "from": settings.email_from,
                "to": to_emails,
                "subject": f"Mizan Daily Report — {project_count} project(s)",
                "html": html,
                "attachments": [attachment],
            })
            return True
        except Exception:
            logger.exception("Failed to send global report email to %s", to_emails)
            return False

    @staticmethod
    async def send_assignment_email(
        to_email: str,
        full_name: str,
        product_name: str,
        role: str,
        product_url: str,
    ) -> bool:
        """Send a product assignment email. Returns True on success."""
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping assignment email to %s", to_email)
            return False

        import resend

        resend.api_key = settings.resend_api_key

        html = (
            f"<h2>Project Assignment</h2>"
            f"<p>Hi {full_name},</p>"
            f"<p>You've been assigned to <strong>{product_name}</strong> "
            f"as <strong>{role}</strong>.</p>"
            f'<p><a href="{product_url}" '
            f'style="display:inline-block;padding:12px 24px;'
            f"background:#2563eb;color:#fff;border-radius:6px;"
            f'text-decoration:none;font-weight:600">'
            f"View Project</a></p>"
            f"<p>Or copy this link: {product_url}</p>"
        )

        try:
            resend.Emails.send({
                "from": settings.email_from,
                "to": [to_email],
                "subject": f"You've been assigned to {product_name}",
                "html": html,
            })
            return True
        except Exception:
            logger.exception("Failed to send assignment email to %s", to_email)
            return False
