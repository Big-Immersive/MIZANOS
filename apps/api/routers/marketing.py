"""Marketing router."""

from uuid import UUID

from fastapi import APIRouter, Depends

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.marketing import (
    ApplyTemplateRequest,
    ApplyTemplateResponse,
    AutoPopulateRequest,
    AutoPopulateResponse,
    ChecklistItemCreate,
    ChecklistItemResponse,
    CredentialCreate,
    CredentialDecryptResponse,
    CredentialResponse,
    DomainCreate,
    DomainResponse,
    DomainUpdate,
    SocialHandleCreate,
    SocialHandleResponse,
    SocialHandleUpdate,
    TemplateTypeResponse,
)
from apps.api.services.marketing_service import MarketingService

router = APIRouter()


def get_service(db: DbSession) -> MarketingService:
    return MarketingService(db)


@router.get("/domains", response_model=list[DomainResponse])
async def list_domains(product_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.get_domains(product_id)


@router.post("/domains", response_model=DomainResponse, status_code=201)
async def create_domain(body: DomainCreate, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.create_domain(body, user_id=user.profile_id if user else None)


@router.patch("/domains/{domain_id}", response_model=DomainResponse)
async def update_domain(domain_id: UUID, body: DomainUpdate, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.update_domain(domain_id, body)


@router.delete("/domains/{domain_id}", status_code=204)
async def delete_domain(domain_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    await service.delete_domain(domain_id)


@router.get("/social-handles", response_model=list[SocialHandleResponse])
async def list_social_handles(product_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.get_social_handles(product_id)


@router.post("/social-handles", response_model=SocialHandleResponse, status_code=201)
async def create_social_handle(body: SocialHandleCreate, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.create_social_handle(body)


@router.patch("/social-handles/{handle_id}", response_model=SocialHandleResponse)
async def update_social_handle(handle_id: UUID, body: SocialHandleUpdate, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.update_social_handle(handle_id, body)


@router.delete("/social-handles/{handle_id}", status_code=204)
async def delete_social_handle(handle_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    await service.delete_social_handle(handle_id)


@router.get("/checklist", response_model=list[ChecklistItemResponse])
async def list_checklist(product_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.get_checklist(product_id)


@router.post("/checklist", response_model=ChecklistItemResponse, status_code=201)
async def create_checklist_item(body: ChecklistItemCreate, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.create_checklist_item(body)


@router.get("/checklist/templates", response_model=list[TemplateTypeResponse])
async def list_template_types(service: MarketingService = Depends(get_service)):
    return await service.get_template_types()


@router.post("/checklist/apply-template", response_model=ApplyTemplateResponse)
async def apply_template(body: ApplyTemplateRequest, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    items = await service.apply_template(body.product_id, body.source_type)
    return ApplyTemplateResponse(items_created=len(items))


@router.patch("/checklist/{item_id}", response_model=ChecklistItemResponse)
async def toggle_checklist_item(item_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.toggle_checklist_item(item_id)


@router.post("/credentials", response_model=CredentialResponse, status_code=201)
async def create_credential(body: CredentialCreate, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.create_credential(body)


@router.get("/credentials", response_model=list[CredentialResponse])
async def list_credentials(product_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.get_credentials(product_id)


@router.delete("/credentials/{credential_id}", status_code=204)
async def delete_credential(credential_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    await service.delete_credential(credential_id)


@router.get("/credentials/{credential_id}/decrypt", response_model=CredentialDecryptResponse)
async def decrypt_credential(credential_id: UUID, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    return await service.decrypt_credential(credential_id)


@router.post("/auto-populate", response_model=AutoPopulateResponse)
async def auto_populate(body: AutoPopulateRequest, user: CurrentUser = None, service: MarketingService = Depends(get_service)):
    user_id = user.profile_id if user else None
    if not user_id:
        from packages.common.utils.error_handlers import bad_request
        raise bad_request("User authentication required for auto-populate")
    result = await service.auto_populate(body, user_id)
    return result
