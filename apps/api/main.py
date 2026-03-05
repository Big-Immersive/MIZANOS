"""Mizan Flow API - FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from apps.api.config import settings
from apps.api.middleware.logging import LoggingMiddleware
from apps.api.middleware.security_headers import SecurityHeadersMiddleware
from apps.api.routers import (
    auth,
    products,
    tasks,
    task_templates,
    task_template_groups,
    qa,
    documents,
    notifications,
    ai,
    github,
    github_pats,
    audit,
    marketing,
    knowledge,
    vault,
    team,
    settings as settings_router,
    specifications,
    scrape,
    transcription,
    system_documents,
    port_generator,
    repo_evaluator,
    deployment_checklist,
    stakeholders,
    integrations,
    evaluations,
    org_chart,
    utilities,
    scans,
)
from apps.api.routers import jobs
from apps.api.routers import (
    external_documents,
    document_folders,
    product_members,
    product_notification_settings,
    specification_sources,
    task_comments,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: startup and shutdown events."""
    yield


app = FastAPI(
    title="Mizan Flow API",
    version="0.1.0",
    description="Product Lifecycle Management Platform",
    lifespan=lifespan,
)

# Middleware stack (order matters - last added runs first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _cors_headers(request: Request) -> dict[str, str]:
    """Build CORS headers if the request origin is allowed."""
    origin = request.headers.get("origin", "")
    if origin in settings.cors_origins:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


@app.exception_handler(StarletteHTTPException)
async def cors_http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Ensure CORS headers are present on HTTP error responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers(request),
    )


@app.exception_handler(Exception)
async def cors_generic_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Ensure CORS headers are present on unhandled 500 errors."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=_cors_headers(request),
    )


# Register routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
# product_members must come before products so /all-members isn't caught by /{product_id}
app.include_router(product_members.router, prefix="/products", tags=["product-members"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(qa.router, prefix="/qa", tags=["qa"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(github.router, prefix="/github", tags=["github"])
app.include_router(github_pats.router, prefix="/github-pats", tags=["github-pats"])
app.include_router(audit.router, prefix="/audits", tags=["audit"])
app.include_router(marketing.router, prefix="/marketing", tags=["marketing"])
app.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
app.include_router(vault.router, prefix="/vault", tags=["vault"])
app.include_router(team.router, prefix="/team", tags=["team"])
app.include_router(settings_router.router, prefix="/settings", tags=["settings"])
app.include_router(specifications.router, prefix="/specifications", tags=["specifications"])
app.include_router(task_templates.router, prefix="/task-templates", tags=["task-templates"])
app.include_router(task_template_groups.router, prefix="/task-template-groups", tags=["task-template-groups"])
app.include_router(scrape.router, prefix="/scrape", tags=["scrape"])
app.include_router(transcription.router, prefix="/transcription", tags=["transcription"])
app.include_router(system_documents.router, prefix="/system-documents", tags=["system-documents"])
app.include_router(port_generator.router, prefix="/port-generator", tags=["port-generator"])
app.include_router(repo_evaluator.router, prefix="/repo-evaluator", tags=["repo-evaluator"])
app.include_router(deployment_checklist.router, prefix="/products", tags=["deployment-checklist"])
app.include_router(stakeholders.router, prefix="/products", tags=["stakeholders"])
app.include_router(integrations.router, prefix="/products", tags=["integrations"])
app.include_router(external_documents.router, prefix="/products", tags=["external-documents"])
app.include_router(document_folders.router, prefix="/products", tags=["document-folders"])
app.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
app.include_router(org_chart.router, prefix="/org-chart", tags=["org-chart"])
app.include_router(product_notification_settings.router, prefix="/products", tags=["product-notification-settings"])
app.include_router(task_comments.router, prefix="/tasks", tags=["task-comments"])
app.include_router(specification_sources.router, prefix="/products", tags=["specification-sources"])
app.include_router(utilities.router, prefix="/utilities", tags=["utilities"])
app.include_router(scans.router, prefix="/scans", tags=["scans"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])


# Mount static files for uploaded avatars
_uploads_dir = Path("uploads")
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}
