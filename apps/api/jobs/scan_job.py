"""Arq job function for high-level repository scanning."""

import logging
from uuid import UUID

from apps.api.jobs.context import JobContext
from apps.api.services.artifact_extractor import ArtifactExtractor
from apps.api.services.progress_matcher import ProgressMatcherService
from apps.api.services.repo_clone_service import RepoCloneService
from apps.api.services.task_service import TaskService

logger = logging.getLogger(__name__)


def _serialize_task(task) -> dict:
    """Serialize a Task ORM instance for the LLM prompt."""
    return {
        "task_id": str(task.id),
        "title": task.title,
        "description": task.description or "",
        "status": task.status or "backlog",
        "priority": task.priority or "medium",
        "pillar": task.pillar or "",
        "verification_criteria": task.verification_criteria or "",
    }


async def high_level_scan_job(ctx: dict, job_id_str: str) -> None:
    """High-level repo scan: clone, extract artifacts, AI-match to tasks."""
    job_id = UUID(job_id_str)
    jctx = JobContext()
    tmp_dir = None

    try:
        session = await jctx.get_session()

        from apps.api.models.audit import RepositoryAnalysis, RepoScanHistory
        from apps.api.models.job import Job
        from apps.api.models.product import Product

        job = await session.get(Job, job_id)
        if job is None:
            logger.error("Job %s not found", job_id)
            return

        product_id = job.product_id

        # 10% — Clone repo
        await jctx.update_progress(job_id, 10, "Cloning repository")
        clone_svc = RepoCloneService(session)
        tmp_dir, commit_sha = await clone_svc.shallow_clone(product_id)

        # 30% — Extract artifacts
        await jctx.update_progress(job_id, 30, "Extracting code artifacts")
        extractor = ArtifactExtractor()
        artifacts = extractor.extract(tmp_dir)

        # 50% — Fetch tasks
        await jctx.update_progress(job_id, 50, "Loading project tasks")
        task_svc = TaskService(session)
        tasks_result = await task_svc.list_tasks(
            product_id=product_id, page_size=500, task_type="task",
        )
        task_dicts = [_serialize_task(t) for t in tasks_result["data"]]

        # 70% — AI matching
        await jctx.update_progress(job_id, 70, "Analyzing progress with AI")
        matcher = ProgressMatcherService(session)
        result = await matcher.match(task_dicts, artifacts)

        # 85% — Store results
        await jctx.update_progress(job_id, 85, "Saving scan results")
        await _save_scan_results(
            session, product_id, commit_sha, artifacts, result,
        )
        await session.commit()

        # 100% — Done
        await jctx.mark_completed(job_id, result_data=result)

    except Exception as exc:
        logger.exception("Scan job %s failed", job_id)
        await jctx.mark_failed(job_id, str(exc))
    finally:
        if tmp_dir:
            RepoCloneService.cleanup(tmp_dir)
        await jctx.close()


async def _save_scan_results(
    session, product_id: UUID, commit_sha: str,
    artifacts: dict, result: dict,
) -> None:
    """Persist scan results to RepositoryAnalysis, RepoScanHistory, Product."""
    from apps.api.models.audit import RepositoryAnalysis, RepoScanHistory
    from apps.api.models.product import Product

    product = await session.get(Product, product_id)
    repo_url = product.repository_url or ""
    branch = product.tracked_branch or "main"

    # Save RepositoryAnalysis
    analysis = RepositoryAnalysis(
        product_id=product_id,
        repository_url=repo_url,
        branch=branch,
        file_count=len(artifacts.get("file_tree", [])),
        structure_map={"file_tree": artifacts.get("file_tree", [])},
        functional_inventory=result.get("task_evidence", []),
        gap_analysis=result.get("scan_summary", {}),
    )
    session.add(analysis)

    # Save RepoScanHistory
    scan_history = RepoScanHistory(
        product_id=product_id,
        repository_url=repo_url,
        branch=branch,
        latest_commit_sha=commit_sha,
        scan_status="completed",
        files_changed=len(artifacts.get("file_tree", [])),
        components_discovered={
            "routes": len(artifacts.get("routes", [])),
            "models": len(artifacts.get("models", [])),
            "schemas": len(artifacts.get("schemas", [])),
            "components": len(artifacts.get("components", [])),
            "pages": len(artifacts.get("pages", [])),
        },
    )
    session.add(scan_history)

    # Update Product progress
    summary = result.get("scan_summary", {})
    progress_pct = summary.get("progress_pct", 0.0)
    if product:
        product.progress = progress_pct

    await session.flush()
