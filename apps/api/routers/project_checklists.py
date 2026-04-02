"""Project checklists router — applied checklists on projects."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.checklist_template import (
    ProjectChecklistItemCreate,
    ProjectChecklistItemResponse,
    ProjectChecklistItemUpdate,
    ProjectChecklistResponse,
)
from apps.api.services.project_checklist_service import ProjectChecklistService

router = APIRouter()


def get_service(db: DbSession) -> ProjectChecklistService:
    return ProjectChecklistService(db)


@router.get("", response_model=list[ProjectChecklistResponse])
async def list_project_checklists(
    product_id: UUID = Query(...),
    checklist_type: str | None = Query(None),
    user: CurrentUser = None,
    service: ProjectChecklistService = Depends(get_service),
):
    checklists = await service.list_checklists(product_id, checklist_type)
    result = []
    for cl in checklists:
        items_resp = []
        for item in cl.items:
            items_resp.append({
                **{c.key: getattr(item, c.key) for c in item.__table__.columns},
                "assignee_name": item.assignee.full_name if item.assignee else None,
            })
        result.append({
            **{c.key: getattr(cl, c.key) for c in cl.__table__.columns},
            "item_count": len(cl.items),
            "completed_count": sum(1 for i in cl.items if i.status == "complete"),
            "items": items_resp,
        })
    return result


@router.get("/{checklist_id}", response_model=ProjectChecklistResponse)
async def get_project_checklist(
    checklist_id: UUID,
    user: CurrentUser = None,
    service: ProjectChecklistService = Depends(get_service),
):
    cl = await service.get_checklist(checklist_id)
    items_resp = []
    for item in cl.items:
        items_resp.append({
            **{c.key: getattr(item, c.key) for c in item.__table__.columns},
            "assignee_name": item.assignee.full_name if item.assignee else None,
        })
    return {
        **{c.key: getattr(cl, c.key) for c in cl.__table__.columns},
        "item_count": len(cl.items),
        "completed_count": sum(1 for i in cl.items if i.status == "complete"),
        "items": items_resp,
    }


@router.delete("/{checklist_id}", status_code=204)
async def delete_project_checklist(
    checklist_id: UUID,
    user: CurrentUser = None,
    service: ProjectChecklistService = Depends(get_service),
):
    await service.delete_checklist(checklist_id)


@router.post("/{checklist_id}/items", response_model=ProjectChecklistItemResponse, status_code=201)
async def add_checklist_item(
    checklist_id: UUID,
    body: ProjectChecklistItemCreate,
    user: CurrentUser = None,
    service: ProjectChecklistService = Depends(get_service),
):
    cl = await service.get_checklist(checklist_id)
    item = await service.add_item(checklist_id, cl.product_id, body.model_dump())
    return {
        **{c.key: getattr(item, c.key) for c in item.__table__.columns},
        "assignee_name": item.assignee.full_name if item.assignee else None,
    }


@router.patch("/items/{item_id}", response_model=ProjectChecklistItemResponse)
async def update_checklist_item(
    item_id: UUID,
    body: ProjectChecklistItemUpdate,
    user: CurrentUser = None,
    service: ProjectChecklistService = Depends(get_service),
):
    item = await service.update_item(item_id, **body.model_dump(exclude_unset=True))
    return {
        **{c.key: getattr(item, c.key) for c in item.__table__.columns},
        "assignee_name": item.assignee.full_name if item.assignee else None,
    }


@router.delete("/items/{item_id}", status_code=204)
async def delete_checklist_item(
    item_id: UUID,
    user: CurrentUser = None,
    service: ProjectChecklistService = Depends(get_service),
):
    await service.delete_item(item_id)
