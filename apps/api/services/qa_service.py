"""QA service."""

import json
import logging
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.qa import QACheck
from apps.api.models.specification import Specification
from apps.api.schemas.qa import QACheckCreate
from apps.api.services.base_service import BaseService
from apps.api.services.llm_config import get_llm_config

logger = logging.getLogger(__name__)


class QAService(BaseService[QACheck]):
    """QA check business logic."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(QACheck, session)

    async def get_by_product(self, product_id: UUID) -> list[QACheck]:
        """Get all QA checks for a product."""
        stmt = select(QACheck).where(QACheck.product_id == product_id)
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def create_check(self, data: QACheckCreate) -> QACheck:
        check = QACheck(**data.model_dump())
        return await self.repo.create(check)

    async def generate_checklist(self, product_id: UUID) -> list[QACheck]:
        """Generate QA checklist using AI."""
        # Get product spec context
        spec_stmt = (
            select(Specification)
            .where(Specification.product_id == product_id)
            .order_by(Specification.version.desc())
            .limit(1)
        )
        spec_result = await self.repo.session.execute(spec_stmt)
        spec = spec_result.scalar_one_or_none()

        spec_context = ""
        if spec and spec.content:
            spec_context = json.dumps(spec.content)[:3000] if isinstance(spec.content, dict) else str(spec.content)[:3000]

        prompt = (
            "Generate a QA checklist for a software product. "
            f"{'Product spec context: ' + spec_context if spec_context else 'No spec available — generate general web app QA checks.'}\n\n"
            "Return ONLY a JSON array of objects with keys: title, category, description. "
            "Categories should be: functionality, performance, security, accessibility, ux. "
            "Generate 8-12 items. No markdown, just valid JSON array."
        )

        try:
            import openai

            config = await get_llm_config(self.repo.session)
            client = openai.AsyncOpenAI(
                api_key=config.api_key, base_url=config.base_url,
            )
            response = await client.chat.completions.create(
                model=config.model,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.choices[0].message.content or "[]"
            from packages.common.utils.json_utils import extract_json_text
            items = json.loads(extract_json_text(content))

            checks: list[QACheck] = []
            for item in items:
                check = QACheck(
                    product_id=product_id,
                    title=item.get("title", "Untitled check"),
                    category=item.get("category", "general"),
                    description=item.get("description"),
                    status="pending",
                )
                self.repo.session.add(check)
                checks.append(check)

            await self.repo.session.flush()
            for check in checks:
                await self.repo.session.refresh(check)
            return checks

        except HTTPException:
            raise
        except json.JSONDecodeError:
            logger.exception("Failed to parse LLM response as JSON")
            raise HTTPException(
                status_code=502,
                detail="AI returned invalid JSON for QA checklist. Please try again.",
            )
        except Exception:
            logger.exception("QA checklist generation failed")
            raise HTTPException(
                status_code=502,
                detail="QA checklist generation failed. Please try again.",
            )
