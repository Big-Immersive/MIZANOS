"""Repo clone service — authenticated or public shallow cloning."""

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

_CLONE_TIMEOUT = 120  # seconds


class RepoCloneService:
    """Clone a product's linked GitHub repo, with or without PAT."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def shallow_clone(self, product_id: UUID) -> tuple[str, str]:
        """Clone repo (depth=1) into a temp dir. Returns (tmp_dir, commit_sha)."""
        product = await self.session.get(Product, product_id)
        if not product:
            raise not_found("Product")
        if not product.repository_url:
            raise bad_request("Product has no linked repository")

        branch = product.tracked_branch or "main"
        clone_url = await self._resolve_clone_url(product)
        tmp_dir = tempfile.mkdtemp(prefix="mizanos_scan_")

        try:
            await self._run_git_clone(clone_url, branch, tmp_dir)
            commit_sha = await self._get_commit_sha(tmp_dir)
        except RuntimeError as exc:
            self.cleanup(tmp_dir)
            raise bad_request(self._friendly_error(str(exc), product)) from exc
        except Exception:
            self.cleanup(tmp_dir)
            raise

        if product.github_pat_id:
            pat_svc = GitHubPatService(self.session)
            await pat_svc.update_last_used(product.github_pat_id)

        logger.info("Cloned %s@%s → %s", product.repository_url, branch, commit_sha[:8])
        return tmp_dir, commit_sha

    async def _resolve_clone_url(self, product: Product) -> str:
        """Build clone URL — authenticated if PAT exists, public otherwise."""
        repo_url = product.repository_url.rstrip("/")
        if not repo_url.endswith(".git"):
            repo_url += ".git"

        if product.github_pat_id:
            pat_svc = GitHubPatService(self.session)
            try:
                raw_token = await pat_svc.decrypt_token(product.github_pat_id)
            except Exception:
                raise bad_request(
                    "Failed to decrypt GitHub PAT. The token may be corrupted — "
                    "try unlinking and re-adding a new PAT."
                )
            verification = await pat_svc.verify_token(raw_token)
            if not verification["valid"]:
                product.github_repo_status = "error"
                product.github_repo_error = "PAT expired or revoked"
                await self.session.flush()
                raise bad_request(
                    "GitHub PAT is expired or revoked. "
                    "Please update the PAT or add a new one."
                )
            return repo_url.replace("https://", f"https://x-access-token:{raw_token}@")

        # No PAT — try public clone
        return repo_url

    @staticmethod
    async def _run_git_clone(clone_url: str, branch: str, dest: str) -> None:
        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--depth", "1", "--branch", branch, clone_url, dest,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=_CLONE_TIMEOUT)
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError("git clone timed out after 2 minutes")
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

    @staticmethod
    def _friendly_error(raw_error: str, product: Product) -> str:
        """Translate git errors into user-facing messages."""
        err = raw_error.lower()
        if "timed out" in err:
            return "Repository clone timed out. The repo may be too large."
        if "could not read username" in err or "authentication" in err or "403" in err:
            return (
                "Authentication failed. The PAT may be expired or lack 'repo' scope. "
                "Try updating the PAT."
            )
        if "not found" in err or "404" in err:
            return (
                f"Repository not found: {product.repository_url}. "
                "Check the URL and ensure the PAT has access."
            )
        if "reference is not a tree" in err or "not a valid ref" in err:
            return (
                f"Branch '{product.tracked_branch}' not found. "
                "Update the tracked branch in project settings."
            )
        return f"Clone failed: {raw_error}"
