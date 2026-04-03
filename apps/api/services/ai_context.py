"""Context gathering for AI chat — pulls project, team, task, and bug data."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def gather_project_context(session: AsyncSession, product_id: UUID | None) -> str:
    """Gather project data to inject into AI system prompt."""
    if not product_id:
        return await _gather_all_projects_context(session)
    return await _gather_single_project_context(session, product_id)


async def _gather_all_projects_context(session: AsyncSession) -> str:
    """Gather complete application context — all projects, team, tasks, bugs, scans."""
    from apps.api.models.audit import RepositoryAnalysis
    from apps.api.models.product import Product, ProductMember
    from apps.api.models.task import Task
    from apps.api.models.user import Profile

    sections: list[str] = []

    # --- Team Members ---
    profiles = list((await session.execute(
        select(Profile).where(Profile.status == "active")
    )).scalars().all())
    members_by_role: dict[str, list[str]] = {}
    for p in profiles:
        role = p.role or "member"
        members_by_role.setdefault(role, []).append(p.full_name or p.email or "Unknown")

    team_lines = [f"TEAM: {len(profiles)} members"]
    for role, names in sorted(members_by_role.items()):
        team_lines.append(f"  {role} ({len(names)}): {', '.join(names)}")
    sections.append("\n".join(team_lines))

    # --- All Projects ---
    products = list((await session.execute(
        select(Product).order_by(Product.name)
    )).scalars().all())
    if not products:
        return "\n\n--- APPLICATION CONTEXT ---\n" + sections[0] + "\n--- END ---\n"

    profile_map = {p.id: p for p in profiles}

    all_members = list((await session.execute(select(ProductMember))).scalars().all())
    member_map: dict[str, list[tuple[str, str]]] = {}
    for m in all_members:
        pid = str(m.product_id)
        profile = profile_map.get(m.profile_id)
        name = (profile.full_name or profile.email or "Unknown") if profile else "Unknown"
        member_map.setdefault(pid, []).append((name, m.role or "member"))

    # Batch-load ALL tasks and scans
    product_ids = [p.id for p in products]
    all_tasks = list((await session.execute(
        select(Task).where(Task.product_id.in_(product_ids), Task.is_draft == False)
    )).scalars().all())
    all_scans = list((await session.execute(
        select(RepositoryAnalysis)
        .where(RepositoryAnalysis.product_id.in_(product_ids))
        .where(RepositoryAnalysis.functional_inventory.is_not(None))
    )).scalars().all())

    tasks_by_product: dict[str, list] = {}
    for t in all_tasks:
        tasks_by_product.setdefault(str(t.product_id), []).append(t)
    scans_by_product: dict[str, RepositoryAnalysis] = {}
    for s in sorted(all_scans, key=lambda x: x.created_at or x.id):
        scans_by_product[str(s.product_id)] = s

    proj_lines = [f"PROJECTS: {len(products)} total"]
    stages: dict[str, int] = {}
    total_tasks = 0
    total_done = 0
    total_bugs = 0

    for p in products:
        stages[p.stage or "Unknown"] = stages.get(p.stage or "Unknown", 0) + 1
        p_tasks = tasks_by_product.get(str(p.id), [])
        tasks = [t for t in p_tasks if t.task_type == "task"]
        bugs = [t for t in p_tasks if t.task_type == "bug"]
        done = sum(1 for t in tasks if t.status in ("done", "live"))
        total_tasks += len(tasks)
        total_done += done
        total_bugs += len(bugs)

        team = member_map.get(str(p.id), [])
        team_str = " | Team: " + ", ".join(f"{n} ({r})" for n, r in team) if team else ""

        scan_info = ""
        scan = scans_by_product.get(str(p.id))
        if scan and scan.gap_analysis and isinstance(scan.gap_analysis, dict):
            scan_info = f" | Scan: {scan.gap_analysis.get('progress_pct', 0):.0f}%"

        bug_info = f" | Bugs: {len(bugs)}" if bugs else ""
        proj_lines.append(
            f"\n  [{p.name}] Stage: {p.stage or 'N/A'} | "
            f"Tasks: {done}/{len(tasks)}{bug_info}{scan_info}{team_str}"
        )

        for t in tasks:
            priority = f" [{t.priority}]" if t.priority else ""
            due = f" (due {t.due_date.strftime('%m/%d')})" if t.due_date else ""
            proj_lines.append(f"    - [{t.status or 'backlog'}]{priority} {t.title}{due}")

        for b in bugs:
            priority = f" [{b.priority}]" if b.priority else ""
            proj_lines.append(f"    - BUG [{b.status or 'reported'}]{priority} {b.title}")

    stage_str = ", ".join(f"{k}: {v}" for k, v in sorted(stages.items()))
    proj_lines.insert(1, f"Stages: {stage_str}")
    proj_lines.insert(2, f"Total: {total_done}/{total_tasks} tasks done, {total_bugs} bugs")
    sections.append("\n".join(proj_lines))

    return (
        "\n\n--- APPLICATION CONTEXT (complete knowledge) ---\n"
        + "\n\n".join(sections)
        + "\n--- END ---\n"
    )


async def _gather_single_project_context(session: AsyncSession, product_id: UUID) -> str:
    """Gather context for a single project — detailed view."""
    from apps.api.models.audit import RepositoryAnalysis
    from apps.api.models.product import Product, ProductMember
    from apps.api.models.task import Task
    from apps.api.models.user import Profile

    context_parts: list[str] = []

    product = await session.get(Product, product_id)
    if product:
        context_parts.append(
            f"PROJECT: {product.name}\n"
            f"Stage: {product.stage or 'N/A'} | Pillar: {product.pillar or 'N/A'}\n"
            f"Repository: {product.repository_url or 'Not linked'}\n"
            f"Created: {product.created_at.strftime('%Y-%m-%d') if product.created_at else 'N/A'}"
        )

    # Tasks
    task_stmt = select(Task).where(Task.product_id == product_id, Task.is_draft == False)
    tasks = list((await session.execute(task_stmt)).scalars().all())
    if tasks:
        by_status: dict[str, int] = {}
        overdue = 0
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        for t in tasks:
            s = t.status or "backlog"
            by_status[s] = by_status.get(s, 0) + 1
            if t.due_date and t.status not in ("done", "live"):
                dd = t.due_date if t.due_date.tzinfo else t.due_date.replace(tzinfo=timezone.utc)
                if dd < now:
                    overdue += 1

        done = by_status.get("done", 0) + by_status.get("live", 0)
        status_str = ", ".join(f"{k}: {v}" for k, v in sorted(by_status.items()))
        context_parts.append(
            f"\nTASKS ({len(tasks)} total, {done} done, {overdue} overdue):\n"
            f"Status breakdown: {status_str}"
        )

        task_lines = []
        for t in tasks:
            priority = f" [{t.priority}]" if t.priority else ""
            due = f" (due {t.due_date.strftime('%m/%d')})" if t.due_date else ""
            task_lines.append(f"  - [{t.status or 'backlog'}]{priority} {t.title}{due}")
        context_parts.append("Task list:\n" + "\n".join(task_lines))

    # Bugs
    bug_stmt = select(Task).where(Task.product_id == product_id, Task.task_type == "bug")
    bugs = list((await session.execute(bug_stmt)).scalars().all())
    if bugs:
        bug_status: dict[str, int] = {}
        bug_lines = []
        for b in bugs:
            s = b.status or "reported"
            bug_status[s] = bug_status.get(s, 0) + 1
            priority = f" [{b.priority}]" if b.priority else ""
            bug_lines.append(f"  - [{s}]{priority} {b.title}")
        context_parts.append(
            f"\nBUGS ({len(bugs)} total):\n"
            f"Status: {', '.join(f'{k}: {v}' for k, v in sorted(bug_status.items()))}\n"
            + "\n".join(bug_lines)
        )

    # Team members (with names)
    member_stmt = select(ProductMember).where(ProductMember.product_id == product_id)
    members = list((await session.execute(member_stmt)).scalars().all())
    if members:
        profile_ids = [m.profile_id for m in members]
        profiles = list((await session.execute(
            select(Profile).where(Profile.id.in_(profile_ids))
        )).scalars().all())
        profile_map = {p.id: p for p in profiles}
        member_lines = []
        for m in members:
            profile = profile_map.get(m.profile_id)
            name = (profile.full_name or profile.email or "Unknown") if profile else "Unknown"
            member_lines.append(f"  - {name} ({m.role or 'member'})")
        context_parts.append(f"\nTEAM ({len(members)} members):\n" + "\n".join(member_lines))

    # Scan results
    scan_stmt = (
        select(RepositoryAnalysis)
        .where(RepositoryAnalysis.product_id == product_id)
        .where(RepositoryAnalysis.functional_inventory.is_not(None))
        .order_by(RepositoryAnalysis.created_at.desc())
        .limit(1)
    )
    scan = (await session.execute(scan_stmt)).scalar_one_or_none()
    if scan and scan.gap_analysis and isinstance(scan.gap_analysis, dict):
        ga = scan.gap_analysis
        context_parts.append(
            f"\nCODE SCAN RESULTS:\n"
            f"Verified: {ga.get('verified', 0)}/{ga.get('total_tasks', 0)} tasks have matching code\n"
            f"Partial: {ga.get('partial', 0)} | No evidence: {ga.get('no_evidence', 0)}\n"
            f"Progress: {ga.get('progress_pct', 0):.0f}%"
        )

    if not context_parts:
        return ""

    return (
        "\n\n--- PROJECT CONTEXT (use this to answer questions) ---\n"
        + "\n".join(context_parts)
        + "\n--- END PROJECT CONTEXT ---\n"
    )
