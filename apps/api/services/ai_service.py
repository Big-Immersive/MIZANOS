"""AI service with LLM integration and SSE streaming."""

import json
from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.ai import AIChatMessage, AIChatSession
from apps.api.services.ai_context import gather_project_context
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
        msg_stmt = select(AIChatMessage).where(AIChatMessage.session_id == session_id)
        msgs = (await self.session.execute(msg_stmt)).scalars().all()
        for msg in msgs:
            await self.session.delete(msg)
        await self.session.delete(chat_session)
        await self.session.flush()
        await self.session.commit()

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

    async def _load_history(self, session_id: UUID, limit: int = 10) -> list[AIChatMessage]:
        """Load recent conversation history for a session."""
        stmt = (
            select(AIChatMessage)
            .where(AIChatMessage.session_id == session_id)
            .order_by(AIChatMessage.created_at.desc())
            .limit(limit)
        )
        history = list((await self.session.execute(stmt)).scalars().all())
        history.reverse()
        return history

    @staticmethod
    def _format_llm_error(err: Exception) -> str:
        """Map LLM exceptions to user-friendly messages."""
        err_str = str(err).lower()
        if "402" in err_str or "credit" in err_str or "afford" in err_str:
            return "⚠️ AI credits exhausted. Please add credits to your OpenRouter account at openrouter.ai/settings/credits to continue using the assistant."
        if "401" in err_str or "auth" in err_str:
            return "⚠️ AI API key is invalid or expired. Please check the OpenRouter API key in your settings."
        if "429" in err_str or "rate" in err_str:
            return "⚠️ Too many requests. Please wait a moment and try again."
        if "timeout" in err_str:
            return "⚠️ The AI took too long to respond. Please try again."
        return f"⚠️ AI error: {str(err)[:200]}"

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

        session_stmt = select(AIChatSession).where(
            AIChatSession.id == session_id,
            AIChatSession.user_id == user_id,
        )
        chat_session = (await self.session.execute(session_stmt)).scalar_one_or_none()
        if not chat_session:
            raise ValueError("Session not found")

        # Load history BEFORE saving current message (so current isn't included)
        history = await self._load_history(session_id)
        project_context = await gather_project_context(self.session, chat_session.product_id)

        # Now save the current user message
        user_msg = AIChatMessage(session_id=session_id, role="user", content=content)
        self.session.add(user_msg)
        await self.session.flush()

        full_response = ""
        try:
            import openai

            config = await get_llm_config(self.session)
            system_prompt = await get_system_prompt(self.session, "chat")
            system_prompt += project_context
            client = openai.AsyncOpenAI(api_key=config.api_key, base_url=config.base_url)

            messages: list[dict] = [{"role": "system", "content": system_prompt}]
            # Only include USER messages from history (not assistant responses)
            # This prevents the model from repeating its previous answers
            for msg in history:
                if msg.content and msg.content.strip() and msg.role == "user":
                    messages.append({"role": "user", "content": msg.content})
                    # Add placeholder for assistant to maintain conversation structure
                    messages.append({"role": "assistant", "content": "(answered)"})

            user_content = self._build_user_content(content, images)
            messages.append({"role": "user", "content": user_content})

            response = await client.chat.completions.create(
                model=config.model, messages=messages, max_tokens=config.max_tokens,
            )
            full_response = response.choices[0].message.content or ""

        except ValueError as e:
            full_response = str(e)
        except Exception as e:
            logger.exception("LLM response error")
            full_response = self._format_llm_error(e)

        assistant_msg = AIChatMessage(
            session_id=session_id, role="assistant", content=full_response
        )
        self.session.add(assistant_msg)
        await self.session.flush()
        await self.session.refresh(assistant_msg)
        return assistant_msg

    async def stream_response(
        self,
        session_id: UUID,
        content: str,
        user_id: str,
        request=None,
    ) -> AsyncIterator[str]:
        """Stream AI response as SSE events.

        If `request` is supplied, the loop checks `request.is_disconnected()`
        between chunks. When the client goes away (Clear chat, tab closed,
        lost network) we stop pulling from the LLM and do NOT save the
        partial assistant message — otherwise the next page load would
        replay a half-finished response as if the bot were talking on
        its own.
        """
        import logging
        logger = logging.getLogger(__name__)

        session_stmt = select(AIChatSession).where(
            AIChatSession.id == session_id,
            AIChatSession.user_id == user_id,
        )
        chat_session = (await self.session.execute(session_stmt)).scalar_one_or_none()
        if not chat_session:
            yield "data: Error: Session not found\n\n"
            yield "data: [DONE]\n\n"
            return

        # Load history BEFORE saving current message (so current isn't included)
        history = await self._load_history(session_id)
        project_context = await gather_project_context(self.session, chat_session.product_id)

        # Save the user message and commit immediately so it's durable even
        # if the client disconnects before the assistant finishes.
        user_msg = AIChatMessage(session_id=session_id, role="user", content=content)
        self.session.add(user_msg)
        await self.session.flush()
        await self.session.commit()

        full_response = ""
        client_disconnected = False

        async def _is_disconnected() -> bool:
            if request is None:
                return False
            try:
                return await request.is_disconnected()
            except Exception:
                return False

        try:
            import openai

            config = await get_llm_config(self.session)
            system_prompt = await get_system_prompt(self.session, "chat")
            system_prompt += project_context

            messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
            for msg in history:
                if msg.content and msg.content.strip() and msg.role == "user":
                    messages.append({"role": "user", "content": msg.content})
                    messages.append({"role": "assistant", "content": "(answered)"})

            messages.append({"role": "user", "content": content})

            client = openai.AsyncOpenAI(api_key=config.api_key, base_url=config.base_url)
            stream = await client.chat.completions.create(
                model=config.model, messages=messages, max_tokens=config.max_tokens, stream=True,
            )

            async for chunk in stream:
                if await _is_disconnected():
                    client_disconnected = True
                    logger.info(
                        "Client disconnected mid-stream for session %s — aborting", session_id,
                    )
                    try:
                        await stream.aclose()
                    except Exception:
                        pass
                    break
                delta = chunk.choices[0].delta.content
                if delta:
                    full_response += delta
                    yield f"data: {json.dumps(delta)}\n\n"

        except ValueError as e:
            full_response = str(e)
            yield f"data: {json.dumps(full_response)}\n\n"
        except Exception as e:
            logger.exception("LLM streaming error")
            full_response = self._format_llm_error(e)
            yield f"data: {json.dumps(full_response)}\n\n"

        # Only persist the assistant reply when the stream actually
        # delivered (client stayed connected AND content is non-empty).
        # A partial response saved here would resurface on the next
        # session load as a ghost message.
        if not client_disconnected and full_response.strip():
            assistant_msg = AIChatMessage(
                session_id=session_id, role="assistant", content=full_response,
            )
            self.session.add(assistant_msg)
            await self.session.flush()
            await self.session.commit()

        yield "data: [DONE]\n\n"
