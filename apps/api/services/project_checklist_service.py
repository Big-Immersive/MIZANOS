"""Project checklist service — applied checklists on projects."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.checklist_template import (
    ProjectChecklist,
    ProjectChecklistItem,
)
from packages.common.utils.error_handlers import not_found


class ProjectChecklistService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_checklists(
        self, product_id: UUID, checklist_type: str | None = None,
    ) -> list[ProjectChecklist]:
        stmt = (
            select(ProjectChecklist)
            .where(ProjectChecklist.product_id == product_id)
            .order_by(ProjectChecklist.created_at.desc())
        )
        if checklist_type:
            stmt = stmt.where(ProjectChecklist.checklist_type == checklist_type)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_checklist(self, checklist_id: UUID) -> ProjectChecklist:
        cl = await self.session.get(ProjectChecklist, checklist_id)
        if not cl:
            raise not_found("ProjectChecklist")
        return cl

    async def delete_checklist(self, checklist_id: UUID) -> None:
        cl = await self.get_checklist(checklist_id)
        await self.session.delete(cl)
        await self.session.flush()

    async def add_item(
        self, checklist_id: UUID, product_id: UUID, data: dict,
    ) -> ProjectChecklistItem:
        await self.get_checklist(checklist_id)
        item = ProjectChecklistItem(
            checklist_id=checklist_id,
            product_id=product_id,
            **data,
        )
        self.session.add(item)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def update_item(self, item_id: UUID, **updates) -> ProjectChecklistItem:
        item = await self.session.get(ProjectChecklistItem, item_id)
        if not item:
            raise not_found("ProjectChecklistItem")
        for k, v in updates.items():
            if v is not None:
                setattr(item, k, v)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def delete_item(self, item_id: UUID) -> None:
        item = await self.session.get(ProjectChecklistItem, item_id)
        if not item:
            raise not_found("ProjectChecklistItem")
        await self.session.delete(item)
        await self.session.flush()
