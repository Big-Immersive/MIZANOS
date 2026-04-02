"""Checklist templates router."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.checklist_template import (
    ApplyTemplateRequest,
    ChecklistCategoryCreate,
    ChecklistCategoryResponse,
    ChecklistTemplateCreate,
    ChecklistTemplateDetailResponse,
    ChecklistTemplateItemCreate,
    ChecklistTemplateItemResponse,
    ChecklistTemplateItemUpdate,
    ChecklistTemplateResponse,
    ChecklistTemplateUpdate,
    ProjectChecklistResponse,
)
from apps.api.services.checklist_template_service import ChecklistTemplateService

router = APIRouter()


def get_service(db: DbSession) -> ChecklistTemplateService:
    return ChecklistTemplateService(db)


@router.get("", response_model=list[ChecklistTemplateResponse])
async def list_templates(
    template_type: str | None = Query(None),
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    return await service.list_templates(template_type)


@router.post("", response_model=ChecklistTemplateDetailResponse, status_code=201)
async def create_template(
    body: ChecklistTemplateCreate,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    t = await service.create_template(
        body.model_dump(), created_by=user.profile_id if user else None,
    )
    return {**{c.key: getattr(t, c.key) for c in t.__table__.columns}, "item_count": 0, "items": []}


# --- File Upload (must be before /{template_id}) ---

@router.post("/upload/preview")
async def preview_upload(
    file: UploadFile = File(...),
    user: CurrentUser = None,
):
    """Parse an uploaded file and return extracted items for preview."""
    from apps.api.services.template_file_parser import parse_csv, parse_with_ai

    content = await file.read()
    filename = file.filename or "unknown"
    lower = filename.lower()

    if lower.endswith(".csv"):
        result = await parse_csv(content)
    else:
        result = await parse_with_ai(content, filename)

    return result


@router.post("/upload/confirm", response_model=ChecklistTemplateDetailResponse)
async def confirm_upload(
    body: dict,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    """Create a template from previously parsed upload data."""
    template_name = body.get("template_name", "Imported Template")
    template_type = body.get("template_type", "general")
    items = body.get("items", [])

    t = await service.create_template(
        {"name": template_name, "template_type": template_type},
        created_by=user.profile_id if user else None,
    )
    for idx, item_data in enumerate(items):
        await service.add_item(t.id, {
            "title": item_data.get("title", ""),
            "category": item_data.get("category", "general"),
            "default_status": item_data.get("default_status", "new"),
            "sort_order": idx,
        })

    await service.session.flush()
    refreshed = await service.get_template(t.id)
    return {
        **{c.key: getattr(refreshed, c.key) for c in refreshed.__table__.columns},
        "item_count": len(refreshed.items),
        "items": refreshed.items,
    }


@router.get("/{template_id}", response_model=ChecklistTemplateDetailResponse)
async def get_template(
    template_id: UUID,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    t = await service.get_template(template_id)
    return {
        **{c.key: getattr(t, c.key) for c in t.__table__.columns},
        "item_count": len(t.items),
        "items": t.items,
    }


@router.patch("/{template_id}", response_model=ChecklistTemplateResponse)
async def update_template(
    template_id: UUID,
    body: ChecklistTemplateUpdate,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    t = await service.update_template(template_id, **body.model_dump(exclude_unset=True))
    return {**{c.key: getattr(t, c.key) for c in t.__table__.columns}, "item_count": len(t.items)}


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    await service.delete_template(template_id)


# --- Template Items ---

@router.post("/{template_id}/items", response_model=ChecklistTemplateItemResponse, status_code=201)
async def add_template_item(
    template_id: UUID,
    body: ChecklistTemplateItemCreate,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    return await service.add_item(template_id, body.model_dump())


@router.patch("/{template_id}/items/{item_id}", response_model=ChecklistTemplateItemResponse)
async def update_template_item(
    template_id: UUID,
    item_id: UUID,
    body: ChecklistTemplateItemUpdate,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    return await service.update_item(item_id, **body.model_dump(exclude_unset=True))


@router.delete("/{template_id}/items/{item_id}", status_code=204)
async def delete_template_item(
    template_id: UUID,
    item_id: UUID,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    await service.delete_item(item_id)


@router.put("/{template_id}/items/reorder", status_code=204)
async def reorder_template_items(
    template_id: UUID,
    body: dict,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    ordered_ids = [UUID(i) for i in body.get("ordered_ids", [])]
    await service.reorder_items(template_id, ordered_ids)


# --- Apply Template ---

@router.post("/{template_id}/apply", response_model=ProjectChecklistResponse)
async def apply_template(
    template_id: UUID,
    body: ApplyTemplateRequest,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    cl = await service.apply_template(
        template_id, body.product_id,
        created_by=user.profile_id if user else None,
    )
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


# --- Categories ---

@router.get("/categories/all", response_model=list[ChecklistCategoryResponse])
async def list_categories(
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    return await service.list_categories()


@router.post("/categories", response_model=ChecklistCategoryResponse, status_code=201)
async def create_category(
    body: ChecklistCategoryCreate,
    user: CurrentUser = None,
    service: ChecklistTemplateService = Depends(get_service),
):
    return await service.create_category(body.name, created_by=user.profile_id if user else None)
