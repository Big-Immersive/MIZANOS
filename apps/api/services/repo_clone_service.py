"""Repo clone service — PAT-authenticated shallow cloning with temp dir management."""

import asyncio
import logging
import shutil
import tempfile
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.product import Product
from apps.api.services.github_pat_service import GitHubPatService
from packages.common.utils.error_handlers import bad_request, not_found

logger = logging.getLogger(__name__)


class RepoCloneService:
    """Clone a product's linked GitHub repo using its encrypted PAT."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def shallow_clone(self, product_id: UUID) -> tuple[str, str]:
        """Clone repo (depth=1) into a temp dir. Returns (tmp_dir, commit_sha)."""
        product = await self.session.get(Product, product_id)
        if not product:
            raise not_found("Product")
        if not product.repository_url:
            raise bad_request("Product has no linked repository")
        if not product.github_pat_id:
            raise bad_request("Product has no linked GitHub PAT")

        branch = product.tracked_branch or "main"
        pat_svc = GitHubPatService(self.session)
        raw_token = await pat_svc.decrypt_token(product.github_pat_id)

        auth_url = self._build_auth_url(product.repository_url, raw_token)
        tmp_dir = tempfile.mkdtemp(prefix="mizanos_scan_")

        try:
            await self._run_git_clone(auth_url, branch, tmp_dir)
            commit_sha = await self._get_commit_sha(tmp_dir)
        except Exception:
            self.cleanup(tmp_dir)
            raise

        await pat_svc.update_last_used(product.github_pat_id)
        logger.info("Cloned %s@%s → %s", product.repository_url, branch, commit_sha[:8])
        return tmp_dir, commit_sha

    @staticmethod
    def _build_auth_url(repo_url: str, token: str) -> str:
        """Insert PAT credentials into the repository URL."""
        url = repo_url.rstrip("/")
        if not url.endswith(".git"):
            url += ".git"
        return url.replace("https://", f"https://x-access-token:{token}@")

    @staticmethod
    async def _run_git_clone(auth_url: str, branch: str, dest: str) -> None:
        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--depth", "1", "--branch", branch, auth_url, dest,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"git clone failed: {stderr.decode().strip()}")

    @staticmethod
    async def _get_commit_sha(repo_dir: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "git", "rev-parse", "HEAD",
            cwd=repo_dir,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        return stdout.decode().strip()

    @staticmethod
    def cleanup(tmp_dir: str) -> None:
        """Remove the temporary clone directory."""
        shutil.rmtree(tmp_dir, ignore_errors=True)
