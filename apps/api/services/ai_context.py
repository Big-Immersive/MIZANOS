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
    from apps.api.models.user import Profile, UserRole

    sections: list[str] = []

    # --- Team Members ---
    profiles = list((await session.execute(
        select(Profile).where(Profile.status == "active")
    )).scalars().all())

    # Pull every (user_id -> role) mapping from user_roles so we honor
    # additional roles too (e.g. Rafay Majeed = engineer + project_manager).
    user_roles_rows = list((await session.execute(
        select(UserRole.user_id, UserRole.role)
    )).all())
    user_roles_map: dict[str, set[str]] = {}
    for user_id, role in user_roles_rows:
        if user_id and role:
            user_roles_map.setdefault(str(user_id), set()).add(role)

    # Build per-profile role set: start with user_roles, fall back to primary.
    profile_roles: dict = {}
    for p in profiles:
        roles = set(user_roles_map.get(str(p.user_id), set()))
        if p.role:
            roles.add(p.role)
        if not roles:
            roles.add("member")
        profile_roles[p.id] = roles

    members_by_role: dict[str, list[str]] = {}
    for p in profiles:
        for r in profile_roles[p.id]:
            members_by_role.setdefault(r, []).append(p.full_name or p.email or "Unknown")

    sections.append(f"TEAM: {len(profiles)} active members")

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

        scan_info = ""
        scan = scans_by_product.get(str(p.id))
        if scan and scan.gap_analysis and isinstance(scan.gap_analysis, dict):
            scan_info = f" | Scan: {scan.gap_analysis.get('progress_pct', 0):.0f}%"

        bug_info = f" | Bugs: {len(bugs)}" if bugs else ""
        proj_lines.append(
            f"  [{p.name}] Stage: {p.stage or 'N/A'} | "
            f"Tasks: {done}/{len(tasks)}{bug_info}{scan_info}"
        )

        # Pre-grouped tasks by status (AI reads facts, doesn't compute)
        if tasks:
            task_by_status: dict[str, list[str]] = {}
            for t in tasks:
                s = t.status or "backlog"
                a = ""
                if t.assignee_id:
                    ap = profile_map.get(t.assignee_id)
                    a = f" ({ap.full_name})" if ap and ap.full_name else ""
                task_by_status.setdefault(s, []).append(f"{t.title}{a}")
            for s, titles in task_by_status.items():
                proj_lines.append(f"    Tasks[{s}]({len(titles)}): {', '.join(titles[:10])}{'...' if len(titles) > 10 else ''}")

        # Pre-grouped bugs by status
        if bugs:
            bug_by_status: dict[str, list[str]] = {}
            for b in bugs:
                s = b.status or "reported"
                bug_by_status.setdefault(s, []).append(b.title)
            for s, titles in bug_by_status.items():
                proj_lines.append(f"    Bugs[{s}]({len(titles)}): {', '.join(titles)}")

    stage_str = ", ".join(f"{k}: {v}" for k, v in sorted(stages.items()))
    proj_lines.insert(1, f"Stages: {stage_str}")
    proj_lines.insert(2, f"Total: {total_done}/{total_tasks} tasks done, {total_bugs} bugs")
    sections.append("\n".join(proj_lines))

    # --- Pre-computed Member-to-Project Summaries (prevents LLM miscounting) ---
    role_project_map: dict[str, dict[str, list[str]]] = {}
    product_name_map = {str(p.id): p.name for p in products}
    for m in all_members:
        profile = profile_map.get(m.profile_id)
        if not profile:
            continue
        name = profile.full_name or profile.email or "Unknown"
        role = m.role or "member"
        role_project_map.setdefault(role, {}).setdefault(name, []).append(
            product_name_map.get(str(m.product_id), "Unknown")
        )

    summary_lines = ["MEMBER-PROJECT SUMMARY (pre-computed, use these facts):"]
    for role in sorted(role_project_map.keys()):
        members_in_role = role_project_map[role]
        sorted_members = sorted(members_in_role.items(), key=lambda x: -len(x[1]))
        summary_lines.append(f"  {role} ({len(members_in_role)} people):")
        for name, projs in sorted_members:
            summary_lines.append(f"    {name}: {len(projs)} projects — {', '.join(projs)}")
    sections.append("\n".join(summary_lines))

    # --- Developer Workload (pre-computed active task counts per assignee) ---
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    done_statuses = {"done", "live", "completed", "verified", "fixed"}

    # Pre-compute project membership count per profile
    project_count_by_profile: dict = {}
    for m in all_members:
        project_count_by_profile[m.profile_id] = project_count_by_profile.get(m.profile_id, 0) + 1

    workload: dict[str, dict] = {}
    for t in all_tasks:
        if not t.assignee_id:
            continue
        profile = profile_map.get(t.assignee_id)
        if not profile:
            continue
        name = profile.full_name or profile.email or "Unknown"
        entry = workload.setdefault(name, {
            "active": 0, "overdue": 0, "total": 0,
            "profile_id": profile.id,
            "projects": project_count_by_profile.get(profile.id, 0),
        })
        entry["total"] += 1
        if (t.status or "").lower() not in done_statuses:
            entry["active"] += 1
            if t.due_date:
                dd = t.due_date if t.due_date.tzinfo else t.due_date.replace(tzinfo=timezone.utc)
                if dd < now:
                    entry["overdue"] += 1
    for p in profiles:
        nm = p.full_name or p.email or "Unknown"
        workload.setdefault(nm, {
            "active": 0, "overdue": 0, "total": 0,
            "profile_id": p.id,
            "projects": project_count_by_profile.get(p.id, 0),
        })

    # Group by role — a person with both `engineer` and `project_manager`
    # appears in BOTH role sections.
    workload_by_role: dict[str, list[tuple[str, dict]]] = {}
    for name, w in workload.items():
        roles = profile_roles.get(w.get("profile_id"), {"member"})
        for role in roles:
            workload_by_role.setdefault(role, []).append((name, w))

    workload_lines = [
        "WORKLOAD BY ROLE (pre-computed — use this to answer workload + "
        "project-assignment questions). When the user asks about a specific "
        "role (engineers, developers, PMs, project managers, operations, "
        "marketing), ONLY list people from that role section.",
        "'engineer' = developer / AI engineer. 'project_manager' = PM.",
        "",
        "TERMINOLOGY — these are DIFFERENT, do not conflate:",
        "- 'Free' / 'available for work' / 'has capacity' = 0 active AND 0 "
        "overdue TASKS (workload-based). Someone can be free but still be a "
        "member of a project.",
        "- 'No project assigned' / 'unassigned to projects' / 'not on a "
        "project' / 'no current project' = 0 PROJECT MEMBERSHIPS "
        "(membership-based). Someone can have 0 projects but still have old "
        "tasks from past work.",
        "- 'Overloaded' = high active count or many overdue.",
        "",
        "EXACT COUNTS (cite these verbatim — do not recount):",
    ]
    for role in sorted(workload_by_role.keys()):
        people = workload_by_role[role]
        free_count = sum(1 for _, w in people if w["active"] == 0 and w["overdue"] == 0)
        busy_count = len(people) - free_count
        unassigned_count = sum(1 for _, w in people if w.get("projects", 0) == 0)
        workload_lines.append(
            f"  {role}: {len(people)} total — {free_count} free (no active tasks), "
            f"{busy_count} busy, {unassigned_count} unassigned to any project"
        )

    workload_lines.append("")
    workload_lines.append("DETAIL:")
    for role in sorted(workload_by_role.keys()):
        people = sorted(workload_by_role[role], key=lambda x: (x[1]["active"], x[0]))
        free_people = [(n, w) for n, w in people if w["active"] == 0 and w["overdue"] == 0]
        busy_people = [(n, w) for n, w in people if not (w["active"] == 0 and w["overdue"] == 0)]
        unassigned_people = [(n, w) for n, w in people if w.get("projects", 0) == 0]
        workload_lines.append(f"  {role} ({len(people)} people):")
        workload_lines.append(f"    FREE — 0 active tasks ({len(free_people)}):")
        for name, w in free_people:
            workload_lines.append(
                f"      - {name} (0 active, 0 overdue, {w['total']} total historical, "
                f"{w.get('projects', 0)} project memberships)"
            )
        workload_lines.append(f"    BUSY — has active tasks ({len(busy_people)}):")
        for name, w in busy_people:
            workload_lines.append(
                f"      - {name} ({w['active']} active, {w['overdue']} overdue, "
                f"{w.get('projects', 0)} project memberships)"
            )
        workload_lines.append(f"    UNASSIGNED TO ANY PROJECT — 0 project memberships ({len(unassigned_people)}):")
        for name, w in unassigned_people:
            workload_lines.append(
                f"      - {name} ({w['active']} active tasks, {w['overdue']} overdue)"
            )
    sections.append("\n".join(workload_lines))

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
        # Build assignee name map
        from apps.api.models.user import Profile
        assignee_ids = {t.assignee_id for t in tasks if t.assignee_id}
        profile_map: dict = {}
        if assignee_ids:
            profiles = list((await session.execute(
                select(Profile).where(Profile.id.in_(assignee_ids))
            )).scalars().all())
            profile_map = {p.id: p.full_name or p.email or "Unknown" for p in profiles}

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
            assignee = f" | {profile_map[t.assignee_id]}" if t.assignee_id and t.assignee_id in profile_map else ""
            task_lines.append(f"  - [{t.status or 'backlog'}]{priority} {t.title}{due}{assignee}")
        context_parts.append("Task list:\n" + "\n".join(task_lines))

    # Bugs
    bug_stmt = select(Task).where(Task.product_id == product_id, Task.task_type == "bug")
    bugs = list((await session.execute(bug_stmt)).scalars().all())
    if bugs:
        # Build bug assignee map
        if not tasks:
            profile_map = {}
        bug_assignee_ids = {b.assignee_id for b in bugs if b.assignee_id} - set(profile_map.keys())
        if bug_assignee_ids:
            from apps.api.models.user import Profile as BugProfile
            bug_profiles = list((await session.execute(
                select(BugProfile).where(BugProfile.id.in_(bug_assignee_ids))
            )).scalars().all())
            for p in bug_profiles:
                profile_map[p.id] = p.full_name or p.email or "Unknown"

        bug_status: dict[str, int] = {}
        bug_lines = []
        for b in bugs:
            s = b.status or "reported"
            bug_status[s] = bug_status.get(s, 0) + 1
            priority = f" [{b.priority}]" if b.priority else ""
            assignee = f" | Assigned: {profile_map[b.assignee_id]}" if b.assignee_id and b.assignee_id in profile_map else ""
            bug_lines.append(f"  - [{s}]{priority} {b.title}{assignee}")
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
