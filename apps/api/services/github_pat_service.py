"""GitHub PAT management service."""

import hashlib
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.github_pat import GitHubPat
from apps.api.models.product import Product
from apps.api.schemas.github_pat import GitHubPatCreate, GitHubPatUpdate
from apps.api.services.base_service import BaseService
from packages.common.utils.encryption import get_fernet
from packages.common.utils.error_handlers import bad_request, not_found


class GitHubPatService(BaseService[GitHubPat]):
    """Manage encrypted GitHub Personal Access Tokens."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(GitHubPat, session)

    async def verify_token(self, raw_token: str) -> dict:
        """Verify a GitHub token by calling the /user API."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {raw_token}",
                    "Accept": "application/vnd.github+json",
                },
                timeout=15,
            )
        if resp.status_code != 200:
            return {"valid": False}

        scopes = resp.headers.get("x-oauth-scopes", "")
        data = resp.json()
        return {
            "valid": True,
            "github_username": data.get("login"),
            "github_avatar_url": data.get("avatar_url"),
            "github_user_id": data.get("id"),
            "scopes": scopes or None,
        }

    @staticmethod
    def _hash_token(raw_token: str) -> str:
        """Produce a deterministic SHA-256 hex digest for duplicate detection."""
        return hashlib.sha256(raw_token.encode()).hexdigest()

    async def create_pat(
        self, data: GitHubPatCreate, profile_id: UUID
    ) -> GitHubPat:
        """Verify, encrypt, and store a GitHub PAT."""
        verification = await self.verify_token(data.token)
        if not verification["valid"]:
            raise bad_request("Invalid GitHub token")

        scopes = verification.get("scopes") or ""
        if "repo" not in scopes:
            raise bad_request(
                "Token is missing the 'repo' scope. "
                "Create a new token with 'repo' access at "
                "https://github.com/settings/tokens"
            )

        token_hash = self._hash_token(data.token)
        await self._check_duplicate(token_hash, profile_id)

        f = get_fernet()
        token_encrypted = f.encrypt(data.token.encode()).decode()

        pat = GitHubPat(
            label=data.label,
            token_encrypted=token_encrypted,
            token_hash=token_hash,
            github_username=verification["github_username"],
            github_avatar_url=verification["github_avatar_url"],
            github_user_id=verification["github_user_id"],
            scopes=verification["scopes"],
            created_by=profile_id,
        )
        return await self.create(pat)

    async def _check_duplicate(
        self, token_hash: str, created_by: UUID
    ) -> None:
        """Raise if the same token is already saved by this user."""
        stmt = select(GitHubPat).where(
            GitHubPat.token_hash == token_hash,
            GitHubPat.created_by == created_by,
        )
        result = await self.repo.session.execute(stmt)
        if result.scalar_one_or_none():
            raise bad_request("This token has already been saved.")

    async def list_pats(
        self, *, created_by: UUID | None = None
    ) -> list[dict]:
        """List active PATs with linked product counts."""
        count_sub = (
            select(func.count())
            .where(Product.github_pat_id == GitHubPat.id)
            .correlate(GitHubPat)
            .scalar_subquery()
        )
        stmt = select(GitHubPat, count_sub.label("linked_products_count")).where(
            GitHubPat.is_active == True  # noqa: E712
        )
        if created_by:
            stmt = stmt.where(GitHubPat.created_by == created_by)
        stmt = stmt.order_by(GitHubPat.created_at.desc())
        result = await self.repo.session.execute(stmt)
        rows = result.all()
        pats = []
        for pat, count in rows:
            pat.linked_products_count = count
            pats.append(pat)
        return pats

    async def decrypt_token(self, pat_id: UUID) -> str:
        """Decrypt and return the raw token (server-side only)."""
        pat = await self.get_or_404(pat_id)
        f = get_fernet()
        return f.decrypt(pat.token_encrypted.encode()).decode()

    async def check_and_update_status(self, pat_id: UUID) -> dict:
        """Decrypt token, verify against GitHub, and persist the status."""
        pat = await self.get_or_404(pat_id)
        f = get_fernet()
        raw_token = f.decrypt(pat.token_encrypted.encode()).decode()
        result = await self.verify_token(raw_token)
        pat.token_status = "valid" if result["valid"] else "expired"
        await self.repo.session.flush()
        return result

    async def update_last_used(self, pat_id: UUID) -> None:
        """Update the last_used_at timestamp."""
        pat = await self.get_or_404(pat_id)
        pat.last_used_at = datetime.now(timezone.utc)
        await self.repo.session.flush()

    async def update_pat(
        self, pat_id: UUID, data: GitHubPatUpdate
    ) -> GitHubPat:
        """Update label or active status."""
        updates = data.model_dump(exclude_unset=True)
        if not updates:
            return await self.get_or_404(pat_id)
        return await self.update(pat_id, updates)

    async def delete_pat(self, pat_id: UUID) -> None:
        """Flag linked products, then delete the PAT."""
        await self.repo.session.execute(
            update(Product)
            .where(Product.github_pat_id == pat_id)
            .values(
                github_pat_id=None,
                github_repo_status="error",
                github_repo_error="Linked PAT was deleted",
            )
        )
        await self.delete(pat_id)
