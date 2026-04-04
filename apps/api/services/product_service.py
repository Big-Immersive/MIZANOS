"""Product service."""

from uuid import UUID

from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.product import (
    Product,
    ProductEnvironment,
    ProductLink,
    ProductManagementNote,
    ProductMember,
    ProductPartnerNote,
)
from apps.api.models.task import Task
from apps.api.schemas.products import (
    ManagementNoteCreate,
    PartnerNoteCreate,
    ProductCreate,
)
from apps.api.dependencies import AuthenticatedUser
from apps.api.models.enums import AppRole
from apps.api.services.base_service import BaseService
from apps.api.services.product_member_service import ProductMemberService
from packages.common.utils.error_handlers import bad_request, forbidden, not_found


class ProductService(BaseService[Product]):
    """Product-specific business logic."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Product, session)

    async def lock_tasks(self, entity_id: UUID) -> Product:
        """Lock tasks — disables generation, enables approve/reject."""
        product = await self.get_or_404(entity_id)
        if product.tasks_locked:
            raise bad_request("Tasks are already locked")
        product.tasks_locked = True
        await self.repo.session.flush()
        await self.repo.session.refresh(product)
        return product

    async def unlock_tasks(self, entity_id: UUID) -> Product:
        """Unlock tasks — re-enables generation, disables approve/reject."""
        product = await self.get_or_404(entity_id)
        if not product.tasks_locked:
            raise bad_request("Tasks are not locked")
        product.tasks_locked = False
        await self.repo.session.flush()
        await self.repo.session.refresh(product)
        return product

    async def archive(self, entity_id: UUID) -> Product:
        """Soft-archive a product by setting archived_at."""
        product = await self.get_or_404(entity_id)
        product.archived_at = datetime.now(timezone.utc)
        await self.repo.session.flush()
        await self.repo.session.refresh(product)
        return product

    async def unarchive(self, entity_id: UUID) -> Product:
        """Restore an archived product."""
        product = await self.get_or_404(entity_id)
        product.archived_at = None
        await self.repo.session.flush()
        await self.repo.session.refresh(product)
        return product

    async def list_products(
        self,
        *,
        page: int = 1,
        page_size: int = 50,
        status: str | None = None,
        search: str | None = None,
        include_archived: bool = False,
    ) -> dict:
        """List products with filtering."""
        stmt = select(Product)

        if not include_archived:
            stmt = stmt.where(Product.archived_at.is_(None))
        if status:
            stmt = stmt.where(Product.status == status)
        if search:
            stmt = stmt.where(Product.name.ilike(f"%{search}%"))

        # Count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.repo.session.execute(count_stmt)).scalar_one()

        # Paginate
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        result = await self.repo.session.execute(stmt)
        data = list(result.scalars().all())

        # Fetch task counts per product (type='task' only)
        product_ids = [p.id for p in data]
        task_counts: dict = {}
        bug_counts: dict = {}
        bugs_fixed: dict = {}
        if product_ids:
            tc_stmt = (
                select(Task.product_id, func.count(Task.id))
                .where(Task.product_id.in_(product_ids), Task.task_type == "task")
                .group_by(Task.product_id)
            )
            tc_result = await self.repo.session.execute(tc_stmt)
            task_counts = dict(tc_result.all())

            bc_stmt = (
                select(Task.product_id, func.count(Task.id))
                .where(Task.product_id.in_(product_ids), Task.task_type == "bug")
                .group_by(Task.product_id)
            )
            bc_result = await self.repo.session.execute(bc_stmt)
            bug_counts = dict(bc_result.all())

            bf_stmt = (
                select(Task.product_id, func.count(Task.id))
                .where(
                    Task.product_id.in_(product_ids),
                    Task.task_type == "bug",
                    Task.status.in_(["fixed", "verified", "live"]),
                )
                .group_by(Task.product_id)
            )
            bf_result = await self.repo.session.execute(bf_stmt)
            bugs_fixed = dict(bf_result.all())

        for product in data:
            product.task_count = task_counts.get(product.id, 0)
            product.bug_count = bug_counts.get(product.id, 0)
            product.bugs_fixed_count = bugs_fixed.get(product.id, 0)

        return {
            "data": data,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_members(self, product_id: UUID) -> list[ProductMember]:
        """List members for a product."""
        stmt = (
            select(ProductMember)
            .where(ProductMember.product_id == product_id)
            .order_by(ProductMember.created_at.desc())
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def get_environments(
        self, product_id: UUID
    ) -> list[ProductEnvironment]:
        """List environments for a product."""
        stmt = (
            select(ProductEnvironment)
            .where(ProductEnvironment.product_id == product_id)
            .order_by(ProductEnvironment.created_at.desc())
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def create_product(
        self, data: ProductCreate, user: AuthenticatedUser
    ) -> Product:
        """Create a new product (superadmin / project_manager only)."""
        if not user.has_any_role(AppRole.SUPERADMIN, AppRole.PROJECT_MANAGER):
            raise forbidden(
                "Only superadmins and project managers can create projects"
            )
        product = Product(**data.model_dump(), created_by=user.profile_id)
        created = await self.repo.create(product)
        if user.has_any_role(AppRole.PROJECT_MANAGER):
            member = ProductMember(
                product_id=created.id,
                profile_id=user.profile_id,
                role="project_manager",
            )
            self.repo.session.add(member)
            await self.repo.session.flush()

        # Auto-apply all active QA templates to the new project
        from apps.api.services.checklist_template_service import ChecklistTemplateService
        checklist_svc = ChecklistTemplateService(self.repo.session)
        await checklist_svc.auto_apply_qa_templates_to_project(
            created.id, user.profile_id,
        )

        return created

    async def update(self, entity_id: UUID, data: dict) -> Product:
        """Update a product. Guards activation on team readiness."""
        if data.get("status") == "active":
            member_svc = ProductMemberService(self.repo.session)
            await member_svc.check_activation_readiness(entity_id)
        return await super().update(entity_id, data)

    # --- Management Notes ---

    async def get_management_notes(
        self, product_id: UUID
    ) -> list[ProductManagementNote]:
        """List management notes for a product."""
        stmt = (
            select(ProductManagementNote)
            .where(ProductManagementNote.product_id == product_id)
            .order_by(
                ProductManagementNote.is_pinned.desc(),
                ProductManagementNote.created_at.desc(),
            )
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def create_management_note(
        self, product_id: UUID, data: ManagementNoteCreate
    ) -> ProductManagementNote:
        """Create a management note."""
        note = ProductManagementNote(
            product_id=product_id, **data.model_dump()
        )
        self.repo.session.add(note)
        await self.repo.session.flush()
        await self.repo.session.refresh(note)
        return note

    async def delete_management_note(self, note_id: UUID) -> None:
        """Delete a management note."""
        note = await self.repo.session.get(
            ProductManagementNote, note_id
        )
        if note is None:
            raise not_found("ProductManagementNote")
        await self.repo.session.delete(note)
        await self.repo.session.flush()

    async def toggle_management_note_pin(
        self, note_id: UUID
    ) -> ProductManagementNote:
        """Toggle the is_pinned flag on a management note."""
        note = await self.repo.session.get(
            ProductManagementNote, note_id
        )
        if note is None:
            raise not_found("ProductManagementNote")
        note.is_pinned = not note.is_pinned
        await self.repo.session.flush()
        await self.repo.session.refresh(note)
        return note

    # --- Partner Notes ---

    async def get_partner_notes(
        self, product_id: UUID
    ) -> list[ProductPartnerNote]:
        """List partner notes for a product."""
        stmt = (
            select(ProductPartnerNote)
            .where(ProductPartnerNote.product_id == product_id)
            .order_by(ProductPartnerNote.created_at.desc())
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def create_partner_note(
        self, product_id: UUID, data: PartnerNoteCreate
    ) -> ProductPartnerNote:
        """Create a partner note."""
        note = ProductPartnerNote(
            product_id=product_id, **data.model_dump()
        )
        self.repo.session.add(note)
        await self.repo.session.flush()
        await self.repo.session.refresh(note)
        return note

    async def delete_partner_note(self, note_id: UUID) -> None:
        """Delete a partner note."""
        note = await self.repo.session.get(
            ProductPartnerNote, note_id
        )
        if note is None:
            raise not_found("ProductPartnerNote")
        await self.repo.session.delete(note)
        await self.repo.session.flush()

    # --- Environments ---

    async def upsert_environment(
        self, product_id: UUID, data
    ) -> ProductEnvironment:
        """Find-or-create environment by product_id + environment_type."""
        stmt = (
            select(ProductEnvironment)
            .where(
                ProductEnvironment.product_id == product_id,
                ProductEnvironment.environment_type == data.environment_type,
            )
        )
        result = await self.repo.session.execute(stmt)
        env = result.scalar_one_or_none()

        update_fields = data.model_dump(exclude_unset=True, exclude={"environment_type"})

        if env:
            for key, value in update_fields.items():
                setattr(env, key, value)
        else:
            env = ProductEnvironment(
                product_id=product_id,
                environment_type=data.environment_type,
                **update_fields,
            )
            self.repo.session.add(env)

        await self.repo.session.flush()
        await self.repo.session.refresh(env)
        return env

    async def delete_environment(
        self, product_id: UUID, env_type: str
    ) -> None:
        """Delete environment by product_id + environment_type."""
        stmt = (
            select(ProductEnvironment)
            .where(
                ProductEnvironment.product_id == product_id,
                ProductEnvironment.environment_type == env_type,
            )
        )
        result = await self.repo.session.execute(stmt)
        env = result.scalar_one_or_none()
        if not env:
            raise not_found("ProductEnvironment")
        await self.repo.session.delete(env)
        await self.repo.session.flush()

    # --- Specification Features & Sources ---

    async def get_specification_features(self, product_id: UUID) -> list:
        from apps.api.models.specification import SpecificationFeature
        stmt = (
            select(SpecificationFeature)
            .where(SpecificationFeature.product_id == product_id)
            .order_by(SpecificationFeature.sort_order)
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def get_specification_sources(self, product_id: UUID) -> list:
        from apps.api.models.specification import SpecificationSource
        stmt = (
            select(SpecificationSource)
            .where(SpecificationSource.product_id == product_id)
            .order_by(SpecificationSource.created_at.desc())
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def create_specification_source(self, product_id: UUID, data) -> object:
        from apps.api.models.specification import SpecificationSource
        source = SpecificationSource(
            product_id=product_id,
            **data.model_dump(exclude_unset=True),
        )
        self.repo.session.add(source)
        await self.repo.session.flush()
        await self.repo.session.refresh(source)
        return source

    async def delete_specification_source(self, source_id: UUID) -> None:
        from apps.api.models.specification import SpecificationSource
        stmt = select(SpecificationSource).where(SpecificationSource.id == source_id)
        result = await self.repo.session.execute(stmt)
        source = result.scalar_one_or_none()
        if not source:
            raise not_found("SpecificationSource")
        await self.repo.session.delete(source)
        await self.repo.session.flush()

    # ------------------------------------------------------------------
    # Project Links
    # ------------------------------------------------------------------

    async def list_project_links(self, product_id: UUID) -> list[ProductLink]:
        stmt = select(ProductLink).where(ProductLink.product_id == product_id).order_by(ProductLink.created_at)
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def create_project_link(self, product_id: UUID, name: str, url: str) -> ProductLink:
        link = ProductLink(product_id=product_id, name=name, url=url)
        self.repo.session.add(link)
        await self.repo.session.flush()
        await self.repo.session.refresh(link)
        return link

    async def update_project_link(self, link_id: UUID, data: dict) -> ProductLink:
        stmt = select(ProductLink).where(ProductLink.id == link_id)
        result = await self.repo.session.execute(stmt)
        link = result.scalar_one_or_none()
        if not link:
            raise not_found("ProductLink")
        for key, val in data.items():
            if val is not None:
                setattr(link, key, val)
        await self.repo.session.flush()
        await self.repo.session.refresh(link)
        return link

    async def delete_project_link(self, link_id: UUID) -> None:
        stmt = select(ProductLink).where(ProductLink.id == link_id)
        result = await self.repo.session.execute(stmt)
        link = result.scalar_one_or_none()
        if not link:
            raise not_found("ProductLink")
        await self.repo.session.delete(link)
        await self.repo.session.flush()
