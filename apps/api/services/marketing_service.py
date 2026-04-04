"""Marketing service."""

import base64
import hashlib
from uuid import UUID

from cryptography.fernet import Fernet
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from apps.api.models.marketing import (
    MarketingChecklistItem,
    MarketingChecklistTemplate,
    MarketingCredential,
    MarketingDomain,
    MarketingSocialHandle,
)
from apps.api.schemas.marketing import AutoPopulateRequest, CredentialCreate
from packages.common.utils.error_handlers import not_found


def _get_fernet() -> Fernet:
    raw = settings.credential_encryption_key.encode()
    derived = hashlib.sha256(raw).digest()
    key = base64.urlsafe_b64encode(derived)
    return Fernet(key)


class MarketingService:
    """Marketing assets management."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_domains(self, product_id: UUID) -> list[MarketingDomain]:
        stmt = select(MarketingDomain).where(MarketingDomain.product_id == product_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_domain(self, data, user_id: UUID | None = None) -> MarketingDomain:
        domain = MarketingDomain(**data.model_dump(), created_by=user_id)
        self.session.add(domain)
        await self.session.flush()
        await self.session.refresh(domain)
        return domain

    async def update_domain(self, domain_id: UUID, data) -> MarketingDomain:
        domain = await self.session.get(MarketingDomain, domain_id)
        if not domain:
            raise not_found("Domain")
        for key, value in data.model_dump(exclude_unset=True).items():
            if hasattr(domain, key):
                setattr(domain, key, value)
        await self.session.flush()
        await self.session.refresh(domain)
        return domain

    async def delete_domain(self, domain_id: UUID) -> None:
        domain = await self.session.get(MarketingDomain, domain_id)
        if not domain:
            raise not_found("Domain")
        await self.session.delete(domain)
        await self.session.flush()

    async def get_social_handles(self, product_id: UUID) -> list[MarketingSocialHandle]:
        stmt = select(MarketingSocialHandle).where(MarketingSocialHandle.product_id == product_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_social_handle(self, data) -> MarketingSocialHandle:
        handle = MarketingSocialHandle(**data.model_dump())
        self.session.add(handle)
        await self.session.flush()
        await self.session.refresh(handle)
        return handle

    async def update_social_handle(
        self, handle_id: UUID, data
    ) -> MarketingSocialHandle:
        handle = await self.session.get(MarketingSocialHandle, handle_id)
        if not handle:
            raise not_found("SocialHandle")
        for key, value in data.model_dump(exclude_unset=True).items():
            if hasattr(handle, key):
                setattr(handle, key, value)
        await self.session.flush()
        await self.session.refresh(handle)
        return handle

    async def delete_social_handle(self, handle_id: UUID) -> None:
        handle = await self.session.get(MarketingSocialHandle, handle_id)
        if not handle:
            raise not_found("SocialHandle")
        await self.session.delete(handle)
        await self.session.flush()

    async def get_checklist(self, product_id: UUID) -> list[MarketingChecklistItem]:
        stmt = (
            select(MarketingChecklistItem)
            .where(MarketingChecklistItem.product_id == product_id)
            .order_by(MarketingChecklistItem.order_index)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_checklist_item(self, data) -> MarketingChecklistItem:
        item = MarketingChecklistItem(**data.model_dump())
        self.session.add(item)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def toggle_checklist_item(self, item_id: UUID) -> MarketingChecklistItem:
        item = await self.session.get(MarketingChecklistItem, item_id)
        if not item:
            raise not_found("Checklist item")
        item.is_completed = not item.is_completed
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def create_credential(self, data: CredentialCreate) -> MarketingCredential:
        password_encrypted = None
        if data.password:
            password_encrypted = _get_fernet().encrypt(
                data.password.encode()
            ).decode()
        credential = MarketingCredential(
            product_id=data.product_id,
            created_by=data.created_by,
            label=data.label,
            credential_type=data.credential_type,
            username=data.username,
            email=data.email,
            password_encrypted=password_encrypted,
            additional_info=data.additional_info,
            domain_id=data.domain_id,
            social_handle_id=data.social_handle_id,
        )
        self.session.add(credential)
        await self.session.flush()
        await self.session.refresh(credential)
        return credential

    async def get_credentials(self, product_id: UUID) -> list[MarketingCredential]:
        stmt = select(MarketingCredential).where(
            MarketingCredential.product_id == product_id
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete_credential(self, credential_id: UUID) -> None:
        credential = await self.session.get(MarketingCredential, credential_id)
        if not credential:
            raise not_found("Credential")
        await self.session.delete(credential)
        await self.session.flush()

    async def auto_populate(
        self, data: AutoPopulateRequest, user_id: UUID
    ) -> dict:
        """Auto-populate marketing records with duplicate detection."""
        domains_created = 0
        handles_created = 0

        # Check existing domains for this product
        existing_domains = await self.get_domains(data.product_id)
        existing_domain_names = {d.domain_name.lower() for d in existing_domains}

        for domain_data in data.domains:
            if domain_data.domain_name.lower() in existing_domain_names:
                continue
            domain = MarketingDomain(
                product_id=data.product_id,
                created_by=user_id,
                domain_name=domain_data.domain_name,
                owner_name="Auto-extracted",
                ssl_status=domain_data.ssl_status,
                is_secured=domain_data.is_secured,
                notes="Auto-extracted during website ingestion",
            )
            self.session.add(domain)
            domains_created += 1

        # Check existing handles for this product
        existing_handles = await self.get_social_handles(data.product_id)
        existing_handle_keys = {
            (h.platform.lower(), h.handle.lower()) for h in existing_handles
        }

        for handle_data in data.social_handles:
            key = (handle_data.platform.lower(), handle_data.handle.lower())
            if key in existing_handle_keys:
                continue
            handle = MarketingSocialHandle(
                product_id=data.product_id,
                registered_by=user_id,
                platform=handle_data.platform,
                handle=handle_data.handle,
                profile_url=handle_data.url,
                is_active=True,
                notes="Auto-extracted during website ingestion",
            )
            self.session.add(handle)
            existing_handle_keys.add(key)
            handles_created += 1

        if domains_created > 0 or handles_created > 0:
            await self.session.flush()

        return {
            "domains_created": domains_created,
            "social_handles_created": handles_created,
        }

    async def get_template_types(self) -> list[dict]:
        """Return available template source_types with item counts."""
        stmt = (
            select(
                MarketingChecklistTemplate.source_type,
                func.count(MarketingChecklistTemplate.id).label("item_count"),
            )
            .where(MarketingChecklistTemplate.is_active == True)  # noqa: E712
            .group_by(MarketingChecklistTemplate.source_type)
        )
        result = await self.session.execute(stmt)
        return [
            {"source_type": row.source_type, "item_count": row.item_count}
            for row in result.all()
        ]

    async def apply_template(
        self, product_id: UUID, source_type: str
    ) -> list[MarketingChecklistItem]:
        """Create checklist items from a template, skipping duplicates."""
        # Fetch template rows
        stmt = (
            select(MarketingChecklistTemplate)
            .where(
                MarketingChecklistTemplate.source_type == source_type,
                MarketingChecklistTemplate.is_active == True,  # noqa: E712
            )
            .order_by(MarketingChecklistTemplate.order_index)
        )
        result = await self.session.execute(stmt)
        templates = list(result.scalars().all())
        if not templates:
            raise not_found("Template")

        # Fetch existing titles for this product to prevent duplicates
        existing_stmt = select(MarketingChecklistItem.title).where(
            MarketingChecklistItem.product_id == product_id
        )
        existing_result = await self.session.execute(existing_stmt)
        existing_titles = {row[0] for row in existing_result.all()}

        created: list[MarketingChecklistItem] = []
        for tmpl in templates:
            if tmpl.title in existing_titles:
                continue
            item = MarketingChecklistItem(
                product_id=product_id,
                title=tmpl.title,
                category=tmpl.category,
                description=tmpl.description,
                is_completed=False,
                order_index=tmpl.order_index,
            )
            self.session.add(item)
            created.append(item)

        if created:
            await self.session.flush()
            for item in created:
                await self.session.refresh(item)
        return created

    async def decrypt_credential(self, credential_id: UUID) -> dict:
        credential = await self.session.get(MarketingCredential, credential_id)
        if not credential:
            raise not_found("Credential")
        password = None
        if credential.password_encrypted:
            try:
                password = _get_fernet().decrypt(
                    credential.password_encrypted.encode()
                ).decode()
            except Exception:
                password = None  # Legacy base64 data
        return {"id": credential.id, "password": password}
