# Repo Scan Flow

How the high-level repo scanning feature works end-to-end.

## 1. Trigger

Two ways to trigger a scan:

### Manual — UI Button
- PM clicks "Scan Now" in `ScanProgressCard.tsx`
- Calls `useTriggerHighLevelScan` mutation -> `scansRepository.triggerHighLevel(productId)`
- Hits `POST /scans/{product_id}/high-level` (`apps/api/routers/scans.py:23`)
- `ScanService.trigger_high_level_scan()` validates the product, checks no scan is already running, creates an Arq background job, and returns immediately

### Auto — GitHub Webhook Push
- Developer pushes to tracked branch
- GitHub sends push webhook -> `POST /webhooks/github`
- `GitHubWebhookService.handle_push_event()` (`apps/api/services/github_webhook_service.py:57-67`):
  1. Matches repo URL to a product
  2. Regenerates system docs
  3. Auto-triggers a scan:
     ```python
     scan_svc = ScanService(self.session)
     await scan_svc.trigger_high_level_scan(product.id, "system")
     ```
  4. Wrapped in try/except -- if a scan is already running, it silently skips

## 2. Clone (`apps/api/services/repo_clone_service.py`)

- Creates a **temp directory** with prefix `mizanos_scan_` via `tempfile.mkdtemp()`
- **Shallow clone** (`depth=1`) of the tracked branch only -- fast, minimal disk usage
- Authenticates using the product's encrypted **GitHub PAT** (decrypted at runtime, injected into the clone URL as `https://x-access-token:{token}@github.com/...`)
- Captures the **commit SHA** via `git rev-parse HEAD`

## 3. Extract Artifacts (`apps/api/services/artifact_extractor.py`)

Surface-level, regex-based extraction (**no function internals read**). Supports multiple tech stacks via the `extraction/` pattern module.

- **File tree** (max depth 4) -- `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.svelte`, `.astro`, `.sol`, `.go`, `.rs`, `.java`, `.kt`, `.rb`, `.php`, `.prisma`, `.graphql`, `.proto`
- **Routes** -- FastAPI, Flask, Django, Express, Rails, Next.js app dir, SvelteKit, Nuxt
- **Models** -- SQLAlchemy, Django ORM, Prisma, Drizzle, TypeORM, Sequelize, Mongoose, Solidity contracts
- **Schemas** -- Pydantic, Marshmallow, Zod, GraphQL types, Solidity structs
- **Components** -- React, Vue, Svelte, Astro
- **Pages** -- Next.js pages dir, SvelteKit routes
- **Dependencies** -- `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle` (scans nested files too)
- **Migrations** -- Alembic, Prisma, Drizzle, Django, Rails, Knex/TypeORM, Hardhat, Foundry
- **Configs** -- Docker, CI, Makefile, tsconfig, vite, next, nuxt, svelte, tailwind, hardhat, foundry, prisma schema

## 4. AI-Powered Matching (`apps/api/services/progress_matcher.py` + `scan_prompts.py`)

- Fetches all tasks (up to 500) from the DB
- Sends tasks + extracted artifacts to an **LLM (via OpenRouter/OpenAI)**
- The LLM evaluates each task against code evidence:
  - Uses `verification_criteria` field if present on the task
  - Otherwise infers what artifacts should exist from the task title/description
- Returns per-task: `verified` (bool), `confidence` (0-1), `artifacts_found`, `summary`

## 5. Store Results

Results are saved in **3 places**:

| Target | What's stored |
|---|---|
| `RepositoryAnalysis` | Full results -- file tree, task evidence list, gap analysis |
| `RepoScanHistory` | Audit trail -- commit SHA, file count, component counts |
| `Product.progress` | Updated to `progress_pct` = (verified / total) x 100 |

## 6. Cleanup

The cloned repo is **always deleted** after the scan:

```python
finally:
    if tmp_dir:
        RepoCloneService.cleanup(tmp_dir)  # shutil.rmtree(tmp_dir, ignore_errors=True)
```

- Runs in a **`finally` block** -- guaranteed cleanup even if the scan crashes mid-way
- Also cleans up if the clone itself fails
- Follows the same pattern used in `audit_service._run_repo_evaluation()`

## Job Progress Phases

| Phase | Progress | Action |
|---|---|---|
| Clone | 10% | Shallow clone repo |
| Extract | 30% | Parse code artifacts |
| Load Tasks | 50% | Fetch tasks from DB |
| AI Match | 70% | LLM evaluates evidence |
| Store | 85% | Persist results |
| Complete | 100% | Cleanup temp dir |

## Key Files

| File | Role |
|---|---|
| `apps/api/jobs/scan_job.py` | Job orchestrator (6 phases) |
| `apps/api/services/repo_clone_service.py` | Clone + cleanup |
| `apps/api/services/artifact_extractor.py` | Code structure extraction |
| `apps/api/services/progress_matcher.py` | LLM-based task matching |
| `apps/api/services/scan_prompts.py` | LLM prompt templates |
| `apps/api/services/scan_service.py` | Business logic + DB persistence |
| `apps/api/routers/scans.py` | HTTP endpoints |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/{product_id}/scans/high-level` | Trigger a new scan |
| `GET` | `/{product_id}/scans/latest` | Get most recent scan result |
| `GET` | `/{product_id}/scans/history` | Paginated scan history |
| `GET` | `/{product_id}/scans/progress-summary` | Quick summary (progress %, last scan, commit SHA) |
