"""Milestones router."""

from uuid import UUID

from fastapi import APIRouter, Depends

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.milestone import (
    MilestoneCreate,
    MilestoneResponse,
    MilestoneUpdate,
)
from apps.api.services.milestone_service import MilestoneService

router = APIRouter()


def get_service(db: DbSession) -> MilestoneService:
    return MilestoneService(db)


@router.get("/{product_id}/milestones", response_model=list[MilestoneResponse])
async def list_milestones(
    product_id: UUID,
    user: CurrentUser = None,
    service: MilestoneService = Depends(get_service),
):
    return await service.list_milestones(product_id)


@router.post("/{product_id}/milestones", response_model=MilestoneResponse, status_code=201)
async def create_milestone(
    product_id: UUID,
    body: MilestoneCreate,
    user: CurrentUser = None,
    service: MilestoneService = Depends(get_service),
):
    m = await service.create_milestone(product_id, body.model_dump())
    return {**{c.key: getattr(m, c.key) for c in m.__table__.columns}, "task_count": 0}


@router.patch("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: UUID,
    body: MilestoneUpdate,
    user: CurrentUser = None,
    service: MilestoneService = Depends(get_service),
):
    m = await service.update_milestone(milestone_id, **body.model_dump(exclude_unset=True))
    return {**{c.key: getattr(m, c.key) for c in m.__table__.columns}, "task_count": 0}


@router.delete("/milestones/{milestone_id}", status_code=204)
async def delete_milestone(
    milestone_id: UUID,
    user: CurrentUser = None,
    service: MilestoneService = Depends(get_service),
):
    await service.delete_milestone(milestone_id)


@router.post("/{product_id}/milestones/ensure-default", response_model=MilestoneResponse)
async def ensure_default(
    product_id: UUID,
    user: CurrentUser = None,
    service: MilestoneService = Depends(get_service),
):
    """Ensure a default 'General' milestone exists and move orphan tasks into it."""
    from apps.api.models.task import Task
    from sqlalchemy import select

    default = await service.ensure_default_milestone(product_id)
    # Move orphan tasks
    stmt = select(Task).where(Task.product_id == product_id, Task.milestone_id.is_(None))
    orphans = list((await service.session.execute(stmt)).scalars().all())
    for t in orphans:
        t.milestone_id = default.id
    await service.session.flush()
    return {**{c.key: getattr(default, c.key) for c in default.__table__.columns}, "task_count": len(orphans)}
