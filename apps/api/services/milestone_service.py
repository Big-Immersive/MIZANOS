"""Milestone service."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.milestone import Milestone
from apps.api.models.task import Task
from packages.common.utils.error_handlers import not_found


class MilestoneService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_milestones(self, product_id: UUID) -> list[dict]:
        stmt = (
            select(Milestone)
            .where(Milestone.product_id == product_id)
            .order_by(Milestone.is_default.desc(), Milestone.sort_order, Milestone.created_at)
        )
        result = await self.session.execute(stmt)
        milestones = list(result.scalars().all())

        output = []
        for m in milestones:
            count_stmt = select(func.count()).select_from(Task).where(
                Task.milestone_id == m.id, Task.is_draft == False
            )
            task_count = (await self.session.execute(count_stmt)).scalar_one()
            output.append({
                **{c.key: getattr(m, c.key) for c in m.__table__.columns},
                "task_count": task_count,
            })
        return output

    async def get_milestone(self, milestone_id: UUID) -> Milestone:
        m = await self.session.get(Milestone, milestone_id)
        if not m:
            raise not_found("Milestone")
        return m

    async def create_milestone(self, product_id: UUID, data: dict) -> Milestone:
        m = Milestone(product_id=product_id, **data)
        self.session.add(m)
        await self.session.flush()
        await self.session.refresh(m)
        return m

    async def update_milestone(self, milestone_id: UUID, **updates) -> Milestone:
        m = await self.get_milestone(milestone_id)
        for k, v in updates.items():
            if v is not None:
                setattr(m, k, v)
        await self.session.flush()
        await self.session.refresh(m)
        return m

    async def delete_milestone(self, milestone_id: UUID) -> None:
        m = await self.get_milestone(milestone_id)
        if m.is_default:
            raise ValueError("Cannot delete the default milestone")
        # Move tasks to default milestone
        default = await self._get_or_create_default(m.product_id)
        stmt = select(Task).where(Task.milestone_id == milestone_id)
        tasks = list((await self.session.execute(stmt)).scalars().all())
        for t in tasks:
            t.milestone_id = default.id
        await self.session.delete(m)
        await self.session.flush()

    async def ensure_default_milestone(self, product_id: UUID) -> Milestone:
        return await self._get_or_create_default(product_id)

    async def _get_or_create_default(self, product_id: UUID) -> Milestone:
        stmt = select(Milestone).where(
            Milestone.product_id == product_id, Milestone.is_default == True
        )
        result = await self.session.execute(stmt)
        default = result.scalar_one_or_none()
        if default:
            return default
        default = Milestone(
            product_id=product_id,
            title="General",
            description="Default milestone for uncategorized tasks",
            is_default=True,
            sort_order=0,
        )
        self.session.add(default)
        await self.session.flush()
        await self.session.refresh(default)
        return default
