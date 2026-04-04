"""Checklist template service — template CRUD and apply logic."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.checklist_template import (
    ChecklistCategory,
    ChecklistTemplate,
    ChecklistTemplateItem,
    ProjectChecklist,
    ProjectChecklistItem,
)
from packages.common.utils.error_handlers import not_found


class ChecklistTemplateService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- Templates ---

    async def list_templates(self, template_type: str | None = None) -> list[dict]:
        stmt = select(ChecklistTemplate).order_by(ChecklistTemplate.created_at.desc())
        if template_type:
            stmt = stmt.where(ChecklistTemplate.template_type == template_type)
        result = await self.session.execute(stmt)
        templates = list(result.scalars().all())
        return [
            {
                **{c.key: getattr(t, c.key) for c in t.__table__.columns},
                "item_count": len(t.items),
            }
            for t in templates
        ]

    async def get_template(self, template_id: UUID) -> ChecklistTemplate:
        t = await self.session.get(ChecklistTemplate, template_id)
        if not t:
            raise not_found("ChecklistTemplate")
        return t

    async def create_template(self, data: dict, created_by: UUID | None = None) -> ChecklistTemplate:
        t = ChecklistTemplate(**data, created_by=created_by)
        self.session.add(t)
        await self.session.flush()
        await self.session.refresh(t)

        # Auto-apply QA and Development templates to all existing projects
        if t.template_type in ("qa", "development"):
            await self._auto_apply_to_all_projects(t, created_by)

        return t

    async def update_template(self, template_id: UUID, **updates) -> ChecklistTemplate:
        t = await self.get_template(template_id)
        for k, v in updates.items():
            if v is not None:
                setattr(t, k, v)
        await self.session.flush()
        await self.session.refresh(t)
        return t

    async def delete_template(self, template_id: UUID) -> None:
        t = await self.get_template(template_id)
        await self.session.delete(t)
        await self.session.flush()

    # --- Template Items ---

    async def add_item(self, template_id: UUID, data: dict) -> ChecklistTemplateItem:
        await self.get_template(template_id)  # ensure exists
        max_order = await self.session.execute(
            select(func.coalesce(func.max(ChecklistTemplateItem.sort_order), -1))
            .where(ChecklistTemplateItem.template_id == template_id)
        )
        next_order = (max_order.scalar_one() or 0) + 1
        item = ChecklistTemplateItem(
            template_id=template_id,
            sort_order=next_order,
            **{k: v for k, v in data.items() if k != "sort_order"},
        )
        self.session.add(item)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def bulk_add_items(self, template_id: UUID, items_data: list[dict]) -> list[ChecklistTemplateItem]:
        await self.get_template(template_id)
        max_result = await self.session.execute(
            select(func.coalesce(func.max(ChecklistTemplateItem.sort_order), -1))
            .where(ChecklistTemplateItem.template_id == template_id)
        )
        sort_order = (max_result.scalar_one() or 0) + 1
        created: list[ChecklistTemplateItem] = []
        for data in items_data:
            item = ChecklistTemplateItem(
                template_id=template_id,
                sort_order=data.get("sort_order", sort_order),
                **{k: v for k, v in data.items() if k != "sort_order"},
            )
            self.session.add(item)
            created.append(item)
            sort_order += 1
        await self.session.flush()
        for item in created:
            await self.session.refresh(item)
        return created

    async def update_item(self, item_id: UUID, **updates) -> ChecklistTemplateItem:
        item = await self.session.get(ChecklistTemplateItem, item_id)
        if not item:
            raise not_found("ChecklistTemplateItem")
        for k, v in updates.items():
            if v is not None:
                setattr(item, k, v)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def delete_item(self, item_id: UUID) -> None:
        item = await self.session.get(ChecklistTemplateItem, item_id)
        if not item:
            raise not_found("ChecklistTemplateItem")
        await self.session.delete(item)
        await self.session.flush()

    async def reorder_items(self, template_id: UUID, ordered_ids: list[UUID]) -> None:
        for idx, item_id in enumerate(ordered_ids):
            item = await self.session.get(ChecklistTemplateItem, item_id)
            if item and item.template_id == template_id:
                item.sort_order = idx
        await self.session.flush()

    # --- Apply Template to Project ---

    async def apply_template(
        self, template_id: UUID, product_id: UUID, created_by: UUID | None = None,
    ) -> ProjectChecklist:
        template = await self.get_template(template_id)
        checklist = ProjectChecklist(
            product_id=product_id,
            template_id=template_id,
            name=template.name,
            checklist_type=template.template_type,
            created_by=created_by,
        )
        self.session.add(checklist)
        await self.session.flush()

        for item in template.items:
            if not (item.is_active if hasattr(item, "is_active") else True):
                continue
            pi = ProjectChecklistItem(
                checklist_id=checklist.id,
                product_id=product_id,
                title=item.title,
                category=item.category,
                status="new",
                sort_order=item.sort_order,
                source_template_item_id=item.id,
            )
            self.session.add(pi)

        await self.session.flush()
        await self.session.refresh(checklist)
        return checklist

    # --- Auto-apply ---

    async def _auto_apply_to_all_projects(
        self, template: ChecklistTemplate, created_by: UUID | None = None,
    ) -> None:
        """Apply a template to every project that doesn't already have it."""
        from apps.api.models.product import Product

        products = list((await self.session.execute(select(Product))).scalars().all())
        existing = set(
            row[0] for row in (await self.session.execute(
                select(ProjectChecklist.product_id).where(
                    ProjectChecklist.template_id == template.id
                )
            )).all()
        )
        for p in products:
            if p.id not in existing:
                await self.apply_template(template.id, p.id, created_by)

    async def auto_apply_qa_templates_to_project(
        self, product_id: UUID, created_by: UUID | None = None,
    ) -> None:
        """Apply all active QA and Development templates to a newly created project."""
        stmt = select(ChecklistTemplate).where(
            ChecklistTemplate.template_type.in_(["qa", "development"]),
            ChecklistTemplate.is_active == True,
        )
        templates = list((await self.session.execute(stmt)).scalars().all())
        for t in templates:
            await self.apply_template(t.id, product_id, created_by)

    # --- Categories ---

    async def list_categories(self) -> list[ChecklistCategory]:
        result = await self.session.execute(
            select(ChecklistCategory).order_by(ChecklistCategory.name)
        )
        return list(result.scalars().all())

    async def create_category(self, name: str, created_by: UUID | None = None) -> ChecklistCategory:
        cat = ChecklistCategory(name=name, created_by=created_by)
        self.session.add(cat)
        await self.session.flush()
        await self.session.refresh(cat)
        return cat
