"""GitHub webhook handler for auto-regenerating system documents."""

import hashlib
import hmac
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.product import Product
from apps.api.services.scan_service import ScanService
from apps.api.services.system_doc_generator import SystemDocGenerator

logger = logging.getLogger(__name__)


class GitHubWebhookService:
    """Handles incoming GitHub push webhooks."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
        """Verify GitHub webhook signature (X-Hub-Signature-256)."""
        expected = (
            "sha256="
            + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        )
        return hmac.compare_digest(expected, signature)

    async def handle_push_event(self, payload: dict) -> dict | None:
        """Process a GitHub push event and trigger doc regeneration."""
        repo_data = payload.get("repository", {})
        clone_url = repo_data.get("clone_url", "")
        html_url = repo_data.get("html_url", "")

        if not clone_url and not html_url:
            logger.warning("Push event missing repository URL")
            return None

        # Match repository to a product
        product = await self._find_product_by_repo(clone_url, html_url)
        if not product:
            logger.info("No product matched for repo: %s", clone_url or html_url)
            return None

        commit_sha = payload.get("after", "")
        logger.info(
            "Triggering doc regeneration for product %s (commit: %s)",
            product.id, commit_sha[:8],
        )

        generator = SystemDocGenerator(self.session)
        docs = await generator.regenerate_from_github(product.id, commit_sha)

        # Auto-trigger high-level progress scan
        scan_triggered = False
        try:
            scan_svc = ScanService(self.session)
            await scan_svc.trigger_high_level_scan(product.id, "system")
            scan_triggered = True
        except Exception:
            logger.warning(
                "Auto-scan skipped for product %s (scan may already be running)",
                product.id,
            )

        return {
            "product_id": str(product.id),
            "docs_regenerated": len(docs),
            "commit_sha": commit_sha,
            "scan_triggered": scan_triggered,
        }

    async def _find_product_by_repo(
        self, clone_url: str, html_url: str
    ) -> Product | None:
        """Find a product whose repository_url matches the webhook payload."""
        urls_to_check = []
        for url in [clone_url, html_url]:
            if url:
                normalized = url.rstrip("/").removesuffix(".git")
                urls_to_check.append(normalized)

        for url in urls_to_check:
            parts = url.split("/")
            if len(parts) >= 2:
                repo_pattern = f"{parts[-2]}/{parts[-1]}"
                stmt = select(Product).where(
                    Product.repository_url.ilike(f"%{repo_pattern}%")
                )
                result = await self.session.execute(stmt)
                product = result.scalar_one_or_none()
                if product:
                    return product

        return None
