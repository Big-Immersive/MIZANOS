"""Specification sources router — CRUD + file upload for project sources."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.products import (
    SpecificationSourceCreate,
    SpecificationSourceResponse,
)
from apps.api.services.gcs_storage_service import GCSStorageService
from apps.api.services.product_service import ProductService
from apps.api.services.source_upload_service import SourceUploadService
from packages.common.utils.error_handlers import not_found

router = APIRouter()


def get_service(db: DbSession) -> ProductService:
    return ProductService(db)


@router.get(
    "/{product_id}/specification-sources",
    response_model=list[SpecificationSourceResponse],
)
async def list_product_sources(
    product_id: UUID,
    user: CurrentUser = None,
    service: ProductService = Depends(get_service),
):
    """Get all specification sources for a product."""
    return await service.get_specification_sources(product_id)


@router.post(
    "/{product_id}/specification-sources",
    response_model=SpecificationSourceResponse,
    status_code=201,
)
async def create_product_source(
    product_id: UUID,
    body: SpecificationSourceCreate,
    user: CurrentUser = None,
    service: ProductService = Depends(get_service),
):
    """Create a specification source for a product."""
    return await service.create_specification_source(product_id, body)


@router.post(
    "/{product_id}/specification-sources/upload",
    response_model=SpecificationSourceResponse,
    status_code=201,
)
async def upload_product_source(
    product_id: UUID,
    file: UploadFile = File(...),
    source_type: str = Form("document"),
    transcription: str | None = Form(None),
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Upload a binary source (document, audio, etc.) to GCS."""
    service = SourceUploadService(db)
    return await service.upload_source(
        product_id, file, source_type=source_type, transcription=transcription,
    )


@router.get("/specification-sources/{source_id}/download-url")
async def get_source_download_url(
    source_id: UUID,
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Generate a temporary download URL for a source file."""
    from apps.api.models.specification import SpecificationSource

    source = await db.get(SpecificationSource, source_id)
    if not source or not source.file_url:
        raise not_found("SpecificationSource")
    storage = GCSStorageService()
    gcs_path = source.file_url
    if gcs_path.startswith("gs://"):
        gcs_path = "/".join(gcs_path.split("/")[3:])
    # Fix legacy records with double sources/ prefix
    gcs_path = gcs_path.replace("/uploads/sources/sources/", "/uploads/sources/")
    return {"download_url": storage.generate_signed_url(gcs_path)}


@router.post("/{product_id}/specification-sources/enrich-all")
async def enrich_all_sources(
    product_id: UUID,
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Enrich all sources for a product that have content but no ai_summary."""
    import json
    import httpx
    from apps.api.config import settings
    from apps.api.models.specification import SpecificationSource
    from sqlalchemy import select

    api_key = settings.openrouter_api_key
    if not api_key:
        return {"enriched": 0, "message": "No AI API key configured"}

    stmt = select(SpecificationSource).where(
        SpecificationSource.specification_id.in_(
            select(Specification.id).where(Specification.product_id == product_id)
        )
    )
    from apps.api.models.specification import Specification
    result = await db.execute(stmt)
    sources = list(result.scalars().all())

    enriched_count = 0
    for source in sources:
        content = source.raw_content or source.transcription or ""
        if not content or len(content.strip()) < 20:
            continue

        prompt = (
            "Analyze the following document and extract a detailed structured summary. "
            "Include ALL specific names, numbers, details, and data points mentioned. "
            "Do NOT summarize vaguely — list every specific item.\n\n"
            "Return ONLY valid JSON (no markdown) with this structure:\n"
            '{"title":"<document title>","summary":"<2-3 sentence overview>",'
            '"sections":[{"heading":"<section name>","details":["<specific detail 1>","<specific detail 2>"]}],'
            '"key_entities":[{"name":"<person/thing name>","role":"<role/description>"}],'
            '"metrics":["<any numbers or stats mentioned>"]}\n\n'
            f"Document content:\n{content[:8000]}"
        )

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": "anthropic/claude-sonnet-4", "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]},
                )
                if resp.status_code != 200:
                    continue

                from packages.common.utils.json_utils import extract_json_text
                raw = resp.json()["choices"][0]["message"]["content"]
                source.ai_summary = json.loads(extract_json_text(raw))
                enriched_count += 1
        except Exception:
            continue

    await db.flush()
    return {"enriched": enriched_count, "total": len(sources), "message": f"Enriched {enriched_count} sources"}


@router.post("/specification-sources/{source_id}/enrich")
async def enrich_source(
    source_id: UUID,
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Use AI to extract detailed information from a source's content."""
    import json
    import httpx
    from apps.api.config import settings
    from apps.api.models.specification import SpecificationSource

    source = await db.get(SpecificationSource, source_id)
    if not source:
        raise not_found("SpecificationSource")

    content = source.raw_content or source.transcription or ""
    if not content or len(content.strip()) < 20:
        return {"ai_summary": source.ai_summary, "message": "Not enough content to enrich"}

    api_key = settings.openrouter_api_key
    if not api_key:
        return {"ai_summary": source.ai_summary, "message": "No AI API key configured"}

    prompt = (
        "Analyze the following document and extract a detailed structured summary. "
        "Include ALL specific names, numbers, details, and data points mentioned. "
        "Do NOT summarize vaguely — list every specific item.\n\n"
        "Return ONLY valid JSON (no markdown) with this structure:\n"
        '{"title":"<document title>","summary":"<2-3 sentence overview>",'
        '"sections":[{"heading":"<section name>","details":["<specific detail 1>","<specific detail 2>"]}],'
        '"key_entities":[{"name":"<person/thing name>","role":"<role/description>"}],'
        '"metrics":["<any numbers or stats mentioned>"]}\n\n'
        f"Document content:\n{content[:8000]}"
    )

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "anthropic/claude-sonnet-4", "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]},
            )
            if resp.status_code != 200:
                return {"ai_summary": source.ai_summary, "message": f"AI error: {resp.status_code}"}

            from packages.common.utils.json_utils import extract_json_text
            raw = resp.json()["choices"][0]["message"]["content"]
            enriched = json.loads(extract_json_text(raw))
            source.ai_summary = enriched
            await db.flush()
            return {"ai_summary": enriched, "message": "Enriched successfully"}
    except Exception as e:
        return {"ai_summary": source.ai_summary, "message": f"Enrichment failed: {str(e)}"}


@router.delete("/specification-sources/{source_id}", status_code=204)
async def delete_product_source(
    source_id: UUID,
    user: CurrentUser = None,
    service: ProductService = Depends(get_service),
):
    """Delete a specification source."""
    await service.delete_specification_source(source_id)
