"""Arq job function for high-level repository scanning."""

import logging
from uuid import UUID

from apps.api.jobs.context import JobContext
from apps.api.services.artifact_extractor import ArtifactExtractor
from apps.api.services.audit_tools import (
    check_hygiene,
    run_code_quality,
    run_dependencies,
    run_security,
)
from apps.api.services.progress_matcher import ProgressMatcherService
from apps.api.services.repo_clone_service import RepoCloneService
from apps.api.services.task_service import TaskService

logger = logging.getLogger(__name__)


def _serialize_task(task) -> dict:
    """Serialize a Task ORM instance for the LLM prompt (minimal fields to save tokens)."""
    d = {
        "task_id": str(task.id),
        "title": task.title,
        "status": task.status or "backlog",
    }
    if task.description:
        d["description"] = task.description[:150]
    if task.verification_criteria:
        d["verification_criteria"] = task.verification_criteria[:200]
    return d


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
        logger.info("Job %s: starting clone for product %s", job_id, product_id)
        clone_svc = RepoCloneService(session)
        tmp_dir, commit_sha = await clone_svc.shallow_clone(product_id)
        logger.info("Job %s: clone complete, commit %s", job_id, commit_sha[:8])

        # 20% — Security audit (gitleaks + osv-scanner + bandit)
        await jctx.update_progress(job_id, 20, "Scanning for secrets and vulnerabilities")
        security_result = await run_security(tmp_dir)

        # 30% — Dependency audit
        await jctx.update_progress(job_id, 30, "Auditing dependencies")
        dependency_result = await run_dependencies(tmp_dir)

        # 45% — Code quality (lizard + jscpd + ruff)
        await jctx.update_progress(job_id, 45, "Measuring code quality")
        code_quality_result = await run_code_quality(tmp_dir)

        # 55% — Project hygiene
        await jctx.update_progress(job_id, 55, "Checking project hygiene")
        hygiene_result = await check_hygiene(tmp_dir)

        audit_results = {
            "security": security_result,
            "dependencies": dependency_result,
            "code_quality": code_quality_result,
            "hygiene": hygiene_result,
        }

        # 65% — Extract artifacts
        await jctx.update_progress(job_id, 65, "Extracting code artifacts")
        extractor = ArtifactExtractor()
        artifacts = extractor.extract(tmp_dir)

        # 75% — Fetch tasks
        await jctx.update_progress(job_id, 75, "Loading project tasks")
        task_svc = TaskService(session)
        tasks_result = await task_svc.list_tasks(
            product_id=product_id, page_size=500, task_type="task",
        )
        task_dicts = [_serialize_task(t) for t in tasks_result["data"]]

        # 85% — AI matching
        await jctx.update_progress(job_id, 85, "Analyzing progress with AI")
        matcher = ProgressMatcherService(session)
        result = await matcher.match(task_dicts, artifacts)

        # 92% — Store results
        await jctx.update_progress(job_id, 92, "Saving audit results")
        await _save_scan_results(
            session, product_id, commit_sha, artifacts, result, audit_results,
        )
        await session.commit()

        # 100% — Done
        await jctx.mark_completed(job_id, result_data=result)

    except Exception as exc:
        logger.exception("Scan job %s failed: %s", job_id, exc)
        await jctx.mark_failed(job_id, str(exc)[:500])
    finally:
        if tmp_dir:
            RepoCloneService.cleanup(tmp_dir)
        await jctx.close()


async def _save_scan_results(
    session, product_id: UUID, commit_sha: str,
    artifacts: dict, result: dict, audit_results: dict | None = None,
) -> None:
    """Persist scan results to RepositoryAnalysis, RepoScanHistory, Product,
    and create an Audit row from the audit_tools output.
    """
    from apps.api.models.audit import Audit, RepositoryAnalysis, RepoScanHistory
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

    # Create Audit row from real tool results (if audit_tools ran)
    if audit_results:
        categories = {
            "security": audit_results["security"]["score"],
            "dependencies": audit_results["dependencies"]["score"],
            "code_quality": audit_results["code_quality"]["score"],
            "hygiene": audit_results["hygiene"]["score"],
        }
        overall = round(sum(categories.values()) / len(categories), 1)

        all_findings: list[dict] = []
        for key in ("security", "dependencies", "code_quality", "hygiene"):
            all_findings.extend(audit_results[key].get("findings", []))

        issues = {
            "critical": [f for f in all_findings if f.get("severity") == "critical"],
            "warnings": [f for f in all_findings if f.get("severity") in ("high", "medium")],
            "info": [f for f in all_findings if f.get("severity") == "low"],
        }

        audit = Audit(
            product_id=product_id,
            overall_score=overall,
            categories=categories,
            issues=issues,
        )
        session.add(audit)

    # Update Product progress
    summary = result.get("scan_summary", {})
    progress_pct = summary.get("progress_pct", 0.0)
    if product:
        product.progress = progress_pct

    await session.flush()
