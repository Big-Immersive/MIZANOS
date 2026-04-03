"""AI service with LLM integration and SSE streaming."""

from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.ai import AIChatMessage, AIChatSession
from apps.api.services.llm_config import get_llm_config, get_system_prompt


class AIService:
    """AI chat with streaming responses."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_sessions(self, user_id: str) -> list[AIChatSession]:
        stmt = (
            select(AIChatSession)
            .where(AIChatSession.user_id == user_id)
            .order_by(AIChatSession.updated_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_session(
        self, user_id: str, product_id: UUID | None = None
    ) -> AIChatSession:
        chat_session = AIChatSession(user_id=user_id, product_id=product_id)
        self.session.add(chat_session)
        await self.session.flush()
        await self.session.refresh(chat_session)
        return chat_session

    async def get_messages(self, session_id: UUID, user_id: str) -> list[AIChatMessage]:
        # Verify the session belongs to this user
        session_stmt = select(AIChatSession).where(
            AIChatSession.id == session_id,
            AIChatSession.user_id == user_id,
        )
        session_result = await self.session.execute(session_stmt)
        if not session_result.scalar_one_or_none():
            return []

        stmt = (
            select(AIChatMessage)
            .where(AIChatMessage.session_id == session_id)
            .order_by(AIChatMessage.created_at)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete_session(self, session_id: UUID, user_id: str) -> None:
        """Delete a chat session and all its messages."""
        session_stmt = select(AIChatSession).where(
            AIChatSession.id == session_id,
            AIChatSession.user_id == user_id,
        )
        result = await self.session.execute(session_stmt)
        chat_session = result.scalar_one_or_none()
        if not chat_session:
            return
        # Delete messages first
        msg_stmt = select(AIChatMessage).where(AIChatMessage.session_id == session_id)
        msgs = (await self.session.execute(msg_stmt)).scalars().all()
        for msg in msgs:
            await self.session.delete(msg)
        await self.session.delete(chat_session)
        await self.session.flush()

    @staticmethod
    def _build_user_content(
        content: str, images: list[str] | None = None,
    ) -> str | list[dict]:
        """Build user message content — plain string or multimodal parts."""
        if not images:
            return content
        parts: list[dict] = [{"type": "text", "text": content}]
        for img in images:
            parts.append({"type": "image_url", "image_url": {"url": img}})
        return parts

    async def send_and_respond(
        self,
        session_id: UUID,
        content: str,
        user_id: str,
        images: list[str] | None = None,
    ) -> AIChatMessage:
        """Send a message and get a non-streaming AI response."""
        import logging
        logger = logging.getLogger(__name__)

        # Verify session ownership
        session_stmt = select(AIChatSession).where(
            AIChatSession.id == session_id,
            AIChatSession.user_id == user_id,
        )
        session_result = await self.session.execute(session_stmt)
        chat_session = session_result.scalar_one_or_none()
        if not chat_session:
            raise ValueError("Session not found")

        # Save user message
        user_msg = AIChatMessage(
            session_id=session_id, role="user", content=content
        )
        self.session.add(user_msg)
        await self.session.flush()

        # Gather project context
        project_context = await self._gather_project_context(chat_session.product_id)

        # Call LLM (non-streaming)
        full_response = ""
        try:
            import openai

            config = await get_llm_config(self.session)
            system_prompt = await get_system_prompt(self.session, "chat")
            system_prompt += project_context
            client = openai.AsyncOpenAI(
                api_key=config.api_key, base_url=config.base_url,
            )

            user_content = self._build_user_content(content, images)
            messages: list[dict] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ]

            response = await client.chat.completions.create(
                model=config.model,
                messages=messages,
                max_tokens=config.max_tokens,
            )
            full_response = response.choices[0].message.content or ""

        except ValueError as e:
            full_response = str(e)
        except Exception as e:
            logger.exception("LLM response error")
            err_str = str(e).lower()
            if "402" in err_str or "credit" in err_str or "afford" in err_str:
                full_response = "⚠️ AI credits exhausted. Please add credits to your OpenRouter account at openrouter.ai/settings/credits to continue using the assistant."
            elif "401" in err_str or "auth" in err_str:
                full_response = "⚠️ AI API key is invalid or expired. Please check the OpenRouter API key in your settings."
            elif "429" in err_str or "rate" in err_str:
                full_response = "⚠️ Too many requests. Please wait a moment and try again."
            else:
                full_response = f"⚠️ AI error: {str(e)[:200]}"

        # Save and return assistant message
        assistant_msg = AIChatMessage(
            session_id=session_id, role="assistant", content=full_response
        )
        self.session.add(assistant_msg)
        await self.session.flush()
        await self.session.refresh(assistant_msg)
        return assistant_msg

    async def _gather_all_projects_context(self) -> str:
        """Gather complete application context — projects, team, tasks, bugs, scans."""
        from apps.api.models.product import Product, ProductMember
        from apps.api.models.task import Task
        from apps.api.models.user import Profile
        from apps.api.models.audit import RepositoryAnalysis

        sections: list[str] = []

        # --- Team Members ---
        profiles = list((await self.session.execute(select(Profile).where(Profile.status == "active"))).scalars().all())
        members_by_role: dict[str, list[str]] = {}
        for p in profiles:
            role = p.role or "member"
            if role not in members_by_role:
                members_by_role[role] = []
            members_by_role[role].append(p.full_name or p.email or "Unknown")

        team_lines = [f"TEAM: {len(profiles)} members"]
        for role, names in sorted(members_by_role.items()):
            team_lines.append(f"  {role} ({len(names)}): {', '.join(names[:10])}")
        sections.append("\n".join(team_lines))

        # --- Projects with assignments ---
        products = list((await self.session.execute(select(Product))).scalars().all())
        if not products:
            return "\n\n--- APPLICATION CONTEXT ---\n" + sections[0] + "\n--- END ---\n"

        all_members = list((await self.session.execute(select(ProductMember))).scalars().all())
        member_map: dict[str, list[tuple[str, str]]] = {}
        for m in all_members:
            pid = str(m.product_id)
            if pid not in member_map:
                member_map[pid] = []
            profile = next((p for p in profiles if p.id == m.profile_id), None)
            name = profile.full_name if profile else "Unknown"
            member_map[pid].append((name, m.role or "member"))

        proj_lines = [f"PROJECTS: {len(products)} total"]
        stages: dict[str, int] = {}
        total_tasks = 0
        total_done = 0
        total_bugs = 0

        for p in products[:25]:
            stages[p.stage or "Unknown"] = stages.get(p.stage or "Unknown", 0) + 1
            # Tasks
            task_stmt = select(Task).where(Task.product_id == p.id, Task.is_draft == False, Task.task_type == "task")
            tasks = list((await self.session.execute(task_stmt)).scalars().all())
            done = sum(1 for t in tasks if t.status in ("done", "live"))
            total_tasks += len(tasks)
            total_done += done
            # Bugs
            bug_stmt = select(Task).where(Task.product_id == p.id, Task.task_type == "bug")
            bugs = list((await self.session.execute(bug_stmt)).scalars().all())
            total_bugs += len(bugs)
            bug_info = f" | Bugs: {len(bugs)}" if bugs else ""
            # Team on this project
            team = member_map.get(str(p.id), [])
            team_str = ""
            if team:
                team_str = " | Team: " + ", ".join(f"{n} ({r})" for n, r in team[:5])
            # Scan
            scan_info = ""
            scan_stmt = (
                select(RepositoryAnalysis)
                .where(RepositoryAnalysis.product_id == p.id)
                .where(RepositoryAnalysis.functional_inventory.is_not(None))
                .order_by(RepositoryAnalysis.created_at.desc())
                .limit(1)
            )
            scan = (await self.session.execute(scan_stmt)).scalar_one_or_none()
            if scan and scan.gap_analysis and isinstance(scan.gap_analysis, dict):
                ga = scan.gap_analysis
                scan_info = f" | Scan: {ga.get('progress_pct', 0):.0f}%"

            proj_lines.append(f"  - {p.name} | Stage: {p.stage or 'N/A'} | Tasks: {done}/{len(tasks)}{bug_info}{scan_info}{team_str}")

        stage_str = ", ".join(f"{k}: {v}" for k, v in sorted(stages.items()))
        proj_lines.insert(1, f"Stages: {stage_str}")
        proj_lines.insert(2, f"Total: {total_done}/{total_tasks} tasks done, {total_bugs} bugs")
        sections.append("\n".join(proj_lines))

        summary = (
            "\n\n--- APPLICATION CONTEXT (complete knowledge) ---\n"
            + "\n\n".join(sections)
            + "\n--- END ---\n"
        )
        return summary

    async def _gather_project_context(self, product_id: UUID | None) -> str:
        """Gather project data to inject into AI system prompt."""
        if not product_id:
            return await self._gather_all_projects_context()

        from apps.api.models.product import Product, ProductMember
        from apps.api.models.task import Task
        from apps.api.models.audit import RepositoryAnalysis

        context_parts: list[str] = []

        # Product details
        product = await self.session.get(Product, product_id)
        if product:
            context_parts.append(
                f"PROJECT: {product.name}\n"
                f"Stage: {product.stage or 'N/A'} | Pillar: {product.pillar or 'N/A'}\n"
                f"Repository: {product.repository_url or 'Not linked'}\n"
                f"Created: {product.created_at.strftime('%Y-%m-%d') if product.created_at else 'N/A'}"
            )

        # Tasks summary
        task_stmt = select(Task).where(Task.product_id == product_id, Task.is_draft == False)
        tasks = list((await self.session.execute(task_stmt)).scalars().all())
        if tasks:
            total = len(tasks)
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
                f"\nTASKS ({total} total, {done} done, {overdue} overdue):\n"
                f"Status breakdown: {status_str}"
            )

            # List task titles (max 30)
            task_lines = []
            for t in tasks[:30]:
                assignee = ""
                priority = f" [{t.priority}]" if t.priority else ""
                due = f" (due {t.due_date.strftime('%m/%d')})" if t.due_date else ""
                task_lines.append(f"  - [{t.status or 'backlog'}]{priority} {t.title}{due}")
            context_parts.append("Task list:\n" + "\n".join(task_lines))

        # Bugs
        bug_stmt = select(Task).where(Task.product_id == product_id, Task.task_type == "bug")
        bugs = list((await self.session.execute(bug_stmt)).scalars().all())
        if bugs:
            bug_status: dict[str, int] = {}
            for b in bugs:
                s = b.status or "reported"
                bug_status[s] = bug_status.get(s, 0) + 1
            context_parts.append(
                f"\nBUGS ({len(bugs)} total):\n"
                f"Status: {', '.join(f'{k}: {v}' for k, v in sorted(bug_status.items()))}"
            )

        # Team members
        member_stmt = select(ProductMember).where(ProductMember.product_id == product_id)
        members = list((await self.session.execute(member_stmt)).scalars().all())
        if members:
            member_lines = [f"  - {m.role or 'member'}" for m in members]
            context_parts.append(f"\nTEAM ({len(members)} members):\n" + "\n".join(member_lines))

        # Scan results
        scan_stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.product_id == product_id)
            .where(RepositoryAnalysis.functional_inventory.is_not(None))
            .order_by(RepositoryAnalysis.created_at.desc())
            .limit(1)
        )
        scan = (await self.session.execute(scan_stmt)).scalar_one_or_none()
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

    async def stream_response(
        self, session_id: UUID, content: str, user_id: str
    ) -> AsyncIterator[str]:
        """Stream AI response as SSE events."""
        # Verify session ownership and get product_id
        session_stmt = select(AIChatSession).where(
            AIChatSession.id == session_id,
            AIChatSession.user_id == user_id,
        )
        session_result = await self.session.execute(session_stmt)
        chat_session = session_result.scalar_one_or_none()
        if not chat_session:
            yield "data: Error: Session not found\n\n"
            yield "data: [DONE]\n\n"
            return

        # Save user message
        user_msg = AIChatMessage(
            session_id=session_id, role="user", content=content
        )
        self.session.add(user_msg)
        await self.session.flush()

        # Gather project context
        project_context = await self._gather_project_context(chat_session.product_id)

        # Stream from LLM (OpenRouter or OpenAI)
        full_response = ""
        try:
            import openai

            config = await get_llm_config(self.session)
            system_prompt = await get_system_prompt(self.session, "chat")
            system_prompt += project_context

            messages: list[dict[str, str]] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ]

            client = openai.AsyncOpenAI(
                api_key=config.api_key, base_url=config.base_url,
            )
            stream = await client.chat.completions.create(
                model=config.model,
                messages=messages,
                max_tokens=config.max_tokens,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    full_response += delta
                    yield f"data: {delta}\n\n"

        except ValueError as e:
            full_response = str(e)
            yield f"data: {full_response}\n\n"
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("LLM streaming error")
            err_str = str(e).lower()
            if "402" in err_str or "credit" in err_str or "afford" in err_str:
                full_response = "⚠️ AI credits exhausted. Please add credits to your OpenRouter account at openrouter.ai/settings/credits to continue using the assistant."
            elif "401" in err_str or "auth" in err_str:
                full_response = "⚠️ AI API key is invalid or expired. Please check the OpenRouter API key in your settings."
            elif "429" in err_str or "rate" in err_str:
                full_response = "⚠️ Too many requests. Please wait a moment and try again."
            elif "timeout" in err_str:
                full_response = "⚠️ The AI took too long to respond. Please try again."
            else:
                full_response = f"⚠️ AI error: {str(e)[:200]}"
            yield f"data: {full_response}\n\n"

        # Save assistant message
        assistant_msg = AIChatMessage(
            session_id=session_id, role="assistant", content=full_response
        )
        self.session.add(assistant_msg)
        await self.session.flush()

        yield "data: [DONE]\n\n"
