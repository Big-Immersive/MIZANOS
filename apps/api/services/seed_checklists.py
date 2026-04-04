"""Auto-seed standard checklist templates on startup."""

import logging
from uuid import uuid4
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.checklist_template import ChecklistTemplate, ChecklistTemplateItem
from packages.common.db.session import async_session_factory

logger = logging.getLogger(__name__)

DEVELOPMENT_ITEMS: list[tuple[str, str]] = [
    # Code Quality & Principles
    ("Apply KISS: simplify logic before shipping, avoid clever code", "Code Quality & Principles"),
    ("Apply DRY: extract shared logic into reusable utilities/modules", "Code Quality & Principles"),
    ("Follow SOLID principles strictly across all classes and modules", "Code Quality & Principles"),
    ("Apply YAGNI: build only what is needed now, not hypothetical futures", "Code Quality & Principles"),
    ("Enforce separation of concerns: one module, one responsibility", "Code Quality & Principles"),
    ("Use meaningful, self-documenting names for variables and functions", "Code Quality & Principles"),
    ("Prefer early returns and guard clauses over deep nesting", "Code Quality & Principles"),
    ("Delete dead code immediately; no commented-out blocks", "Code Quality & Principles"),
    # Architecture & Design
    ("Design for modularity: clear boundaries between components", "Architecture & Design"),
    ("Use dependency injection; depend on abstractions, not concretions", "Architecture & Design"),
    ("Apply appropriate design patterns (factory, strategy, observer)", "Architecture & Design"),
    ("Design RESTful APIs with consistent naming, versioning, and status codes", "Architecture & Design"),
    ("Separate configuration from code using environment variables", "Architecture & Design"),
    ("Use layered architecture: presentation, business logic, data access", "Architecture & Design"),
    ("Define clear contracts/interfaces between services and modules", "Architecture & Design"),
    ("Favor composition over inheritance", "Architecture & Design"),
    # Version Control & Git
    ("Use a branching strategy (GitFlow, trunk-based, or GitHub Flow)", "Version Control & Git"),
    ("Write conventional commit messages: type(scope): summary", "Version Control & Git"),
    ("Keep commits atomic: one logical change per commit", "Version Control & Git"),
    ("Require pull request reviews before merging to main", "Version Control & Git"),
    ("Protect main/master branch with branch protection rules", "Version Control & Git"),
    ("Never commit secrets, credentials, or .env files", "Version Control & Git"),
    ("Use .gitignore aggressively for build artifacts and dependencies", "Version Control & Git"),
    ("Tag releases with semantic versioning (vMAJOR.MINOR.PATCH)", "Version Control & Git"),
    # Security
    ("Address OWASP Top 10: injection, XSS, CSRF, IDOR", "Security"),
    ("Validate and sanitize all user inputs server-side", "Security"),
    ("Hash passwords with bcrypt (min 12 rounds), never store plaintext", "Security"),
    ("Use HTTPS only; set secure, httpOnly, sameSite on cookies", "Security"),
    ("Store secrets in environment variables or a vault, never in code", "Security"),
    ("Apply principle of least privilege on all roles and permissions", "Security"),
    ("Rate-limit auth endpoints; return 429 with Retry-After header", "Security"),
    ("Implement CSP headers and disable unnecessary HTTP methods", "Security"),
    # Testing
    ("Write unit tests for all business logic and pure functions", "Testing"),
    ("Write integration tests for API endpoints and service interactions", "Testing"),
    ("Write E2E tests for critical user flows", "Testing"),
    ("Mock external dependencies (DB, APIs, queues) in unit tests", "Testing"),
    ("Enforce minimum meaningful code coverage threshold (e.g., 80%)", "Testing"),
    ("Tests must be deterministic: no flaky or order-dependent tests", "Testing"),
    ("Mirror source structure in /tests directory", "Testing"),
    ("Cover happy path, edge cases, and failure scenarios", "Testing"),
    # Performance
    ("Profile before optimizing; measure, don't guess", "Performance"),
    ("Add indexes on foreign keys and frequently queried columns", "Performance"),
    ("Implement caching for expensive operations", "Performance"),
    ("Use lazy loading for non-critical resources and modules", "Performance"),
    ("Paginate all list queries; no unbounded SELECT * in production", "Performance"),
    ("Avoid N+1 queries; use joins or batch fetching", "Performance"),
    ("Set timeouts on all external calls (HTTP, DB, cache)", "Performance"),
    ("Compress API responses and static assets (gzip/brotli)", "Performance"),
    # Documentation
    ("Maintain a clear README with setup, run, and deploy instructions", "Documentation"),
    ("Document all API endpoints with request/response examples", "Documentation"),
    ("Use inline comments only to explain 'why', never 'what'", "Documentation"),
    ("Keep an Architecture Decision Record (ADR) for major decisions", "Documentation"),
    ("Document environment variables with descriptions and defaults", "Documentation"),
    ("Maintain a CHANGELOG for each release", "Documentation"),
    ("Add JSDoc/docstrings to public functions and interfaces", "Documentation"),
    # Error Handling & Logging
    ("Use structured logging (JSON) with consistent log levels", "Error Handling & Logging"),
    ("Never swallow errors silently; log or propagate every exception", "Error Handling & Logging"),
    ("Implement global error boundaries/handlers in every service", "Error Handling & Logging"),
    ("Include correlation/request IDs in all log entries", "Error Handling & Logging"),
    ("Set up monitoring and alerting (uptime, error rate, latency)", "Error Handling & Logging"),
    ("Log sufficient context for debugging without leaking PII", "Error Handling & Logging"),
    ("Handle promise rejections and async errors explicitly", "Error Handling & Logging"),
    ("Return consistent error response format from all API endpoints", "Error Handling & Logging"),
    # CI/CD & DevOps
    ("Automate builds, tests, and linting on every push/PR", "CI/CD & DevOps"),
    ("Use multi-stage Docker builds; run as non-root user", "CI/CD & DevOps"),
    ("Pin dependency versions and base image versions", "CI/CD & DevOps"),
    ("Separate environments: dev, staging, production", "CI/CD & DevOps"),
    ("Implement automated rollback on deployment failure", "CI/CD & DevOps"),
    ("Use infrastructure as code (Terraform, Pulumi, etc.)", "CI/CD & DevOps"),
    ("Implement graceful shutdown: drain in-flight requests on exit", "CI/CD & DevOps"),
    ("Scan dependencies for known vulnerabilities (npm audit, Snyk)", "CI/CD & DevOps"),
    # Database
    ("Use safe, idempotent migrations (CREATE IF NOT EXISTS pattern)", "Database"),
    ("Use parameterized queries only; never interpolate user input", "Database"),
    ("Use transactions for multi-row/multi-table operations", "Database"),
    ("Use connection pooling; never one connection per request", "Database"),
    ("Set query timeouts; never let a query run indefinitely", "Database"),
    ("Prefer soft deletes where data history matters", "Database"),
    ("Backup databases on automated schedule with tested restores", "Database"),
    ("Normalize schema properly; denormalize only with justification", "Database"),
    # Code Review
    ("Review for correctness, readability, and maintainability", "Code Review"),
    ("Verify no hardcoded secrets, credentials, or magic numbers", "Code Review"),
    ("Check for proper error handling and edge case coverage", "Code Review"),
    ("Ensure new code has accompanying tests", "Code Review"),
    ("Validate naming conventions and project style guide adherence", "Code Review"),
    ("Look for performance issues: N+1 queries, missing indexes", "Code Review"),
    ("Confirm no unnecessary dependencies were added", "Code Review"),
    ("Use automated linters/formatters to enforce style before review", "Code Review"),
    # Accessibility & UX
    ("Meet WCAG 2.1 AA compliance at minimum", "Accessibility & UX"),
    ("Use semantic HTML elements (nav, main, article, button)", "Accessibility & UX"),
    ("Ensure all interactive elements are keyboard navigable", "Accessibility & UX"),
    ("Provide alt text for all images and ARIA labels where needed", "Accessibility & UX"),
    ("Test responsive design across mobile, tablet, and desktop", "Accessibility & UX"),
    ("Verify cross-browser compatibility (Chrome, Firefox, Safari, Edge)", "Accessibility & UX"),
    ("Ensure color contrast ratios meet accessibility standards", "Accessibility & UX"),
    ("Support screen readers and assistive technologies", "Accessibility & UX"),
]


async def seed_development_checklist(session: AsyncSession) -> None:
    """Create the Development Standard Checklist if it doesn't exist."""
    stmt = select(ChecklistTemplate).where(
        ChecklistTemplate.template_type == "development",
        ChecklistTemplate.name == "Development Standard Checklist",
    )
    result = await session.execute(stmt)
    if result.scalar_one_or_none():
        return  # Already exists

    now = datetime.now(timezone.utc)
    template = ChecklistTemplate(
        name="Development Standard Checklist",
        template_type="development",
        description="General development standards and principles to be followed for every project",
        is_active=True,
    )
    session.add(template)
    await session.flush()

    for i, (title, category) in enumerate(DEVELOPMENT_ITEMS):
        item = ChecklistTemplateItem(
            template_id=template.id,
            title=title,
            category=category,
            default_status="new",
            sort_order=i + 1,
        )
        session.add(item)

    await session.flush()
    logger.info("Seeded Development Standard Checklist with %d items", len(DEVELOPMENT_ITEMS))


async def run_checklist_seeds() -> None:
    """Run all checklist seeds. Called from app lifespan."""
    async with async_session_factory() as session:
        await seed_development_checklist(session)
        await session.commit()
