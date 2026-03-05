# GitHub Repo Scan — High-Level Progress Tracking

**Date**: 2026-02-27

## Context

MIZANOS Products are linked to GitHub repos (`Product.repository_url`, `Product.github_pat_id`, `Product.tracked_branch`). PMs create tasks assigned to developers. Currently, task status is manually updated. We want to **auto-verify progress** by scanning the repo's tracked branch and cross-referencing tasks marked as "done" against actual code evidence using AI-assisted matching.

**Decisions made:**
- Build **high-level scan first** (deep scan later as Phase 2)
- Task mapping: **AI-assisted + optional `verification_criteria` field** on tasks
- Trigger: **Auto on push** (via existing webhook) **+ manual** trigger from UI

---

## Two Scan Types (Strategy Overview)

### High-Level Scan (This Plan — Progress Tracking)
Scans **structure only** — file tree, route definitions, model/schema names, package deps, migrations, configs. Uses Claude API to match task list against discovered artifacts. Fast (30s-2min), cheap, automatable on every push.

**Best for**: PM dashboards, sprint reviews, stakeholder reporting — "are we building the right things?"

### Deep Scan (Future Phase 2 — Quality Verification)
Reads **full source code** — function implementations, error handling, tests, security patterns, SOLID compliance. Uses Claude Code CLI in isolated container (Docker/OpenClaw) for interactive analysis.

**Best for**: Milestone reviews, pre-merge checks, tech lead reviews — "are we building things right?"

### How They Complement Each Other
```
Push to tracked branch
    ↓
HIGH-LEVEL SCAN (automatic, fast)
    → "Task X: Evidence found, Task Y: No evidence"
    → Updates product.progress automatically
    → PM sees dashboard update in real-time

Weekly / Milestone / On-demand
    ↓
DEEP SCAN (manual trigger)
    → "Task X: Implemented but missing error handling"
    → "Task Y: Security issue in auth middleware"
    → Quality scores per task and overall
    → Detailed report for tech lead review
```

---

## Existing Infrastructure We'll Reuse

| What | Where | How |
|------|-------|-----|
| PAT decryption | `GitHubPatService.decrypt_token(pat_id)` | Get raw token for authenticated clone |
| Repo ↔ Product linking | `Product.repository_url`, `github_pat_id`, `tracked_branch` | Know which repo/branch to scan |
| Webhook handler | `GitHubWebhookService.handle_push_event()` | Trigger scan on push |
| Arq job queue | `apps/api/jobs/` + `Job` model with progress 0-100 | Background scan execution |
| `JobContext` | `apps/api/jobs/context.py` | DB sessions + progress tracking in workers |
| `RepositoryAnalysis` model | `apps/api/models/audit.py:61-84` | Store results in existing JSONB fields: `structure_map`, `functional_inventory`, `gap_analysis` |
| `RepoScanHistory` model | `apps/api/models/audit.py:34-59` | Track scan metadata (commit SHA, files, components) |
| `StructureAnalyzer` | `apps/api/services/analyzers/structure.py` | Reuse file collection + LOC counting |
| `TechStackAnalyzer` | `apps/api/services/analyzers/tech_stack.py` | Reuse language/framework detection |
| LLM config | `apps/api/services/llm_config.py` → `get_llm_config(session)` | OpenRouter/OpenAI client setup |
| Audit clone pattern | `AuditService._run_repo_evaluation()` at `audit_service.py:108-142` | Pattern for temp dir clone + cleanup |

---

## Implementation Plan

### Step 1: Add `verification_criteria` to Task model

**`apps/api/models/task.py`** — add field:
```python
verification_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

**`apps/api/schemas/tasks.py`** — add to `TaskBase`, `TaskUpdate`, `TaskResponse`:
```python
verification_criteria: str | None = None
```

**`apps/web/src/lib/types/task.ts`** — add to `Task` interface:
```typescript
verification_criteria: string | null;
```

**Migration**: `make db-makemigration` → `make db-migrate`

---

### Step 2: Create `RepoCloneService`

**NEW: `apps/api/services/repo_clone_service.py`** (~60 LOC)

Responsible for PAT-authenticated git cloning with temp directory management.

```python
class RepoCloneService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def shallow_clone(self, product_id: UUID) -> tuple[str, str]:
        """Clone repo (depth=1) into temp dir. Returns (tmp_dir, commit_sha)."""
        # 1. Load Product → get repository_url, github_pat_id, tracked_branch
        # 2. Decrypt PAT via GitHubPatService.decrypt_token(pat_id)
        # 3. Build authenticated URL: https://x-access-token:{token}@github.com/owner/repo.git
        # 4. subprocess.run(["git", "clone", "--depth", "1", "--branch", branch, auth_url, tmp_dir])
        # 5. Get commit SHA: subprocess.run(["git", "rev-parse", "HEAD"], cwd=tmp_dir)
        # 6. Update GitHubPatService.update_last_used(pat_id)
        # 7. Return (tmp_dir, commit_sha)

    @staticmethod
    def cleanup(tmp_dir: str) -> None:
        """Remove cloned repo directory."""
        shutil.rmtree(tmp_dir, ignore_errors=True)
```

**Key difference from `AuditService._run_repo_evaluation`**: Uses PAT for private repo access (existing audit code clones without auth, only works for public repos).

---

### Step 3: Create `ArtifactExtractor`

**NEW: `apps/api/services/artifact_extractor.py`** (~200 LOC)

Extracts high-level code artifacts from a cloned repo without reading function internals.

```python
class ArtifactExtractor:
    def extract(self, repo_path: str) -> dict:
        """Extract all artifacts from repo. Returns structured dict."""
        return {
            "file_tree": self._extract_file_tree(repo_path),
            "routes": self._extract_routes(repo_path),
            "models": self._extract_models(repo_path),
            "schemas": self._extract_schemas(repo_path),
            "components": self._extract_components(repo_path),
            "pages": self._extract_pages(repo_path),
            "dependencies": self._extract_dependencies(repo_path),
            "migrations": self._extract_migrations(repo_path),
            "configs": self._extract_configs(repo_path),
        }
```

**What each method extracts (surface-level only):**

| Method | What It Reads | Output |
|--------|--------------|--------|
| `_extract_file_tree` | Directory listing (filtered, no node_modules etc.) | Nested dict of dirs/files |
| `_extract_routes` | Grep for `@router`, `@app.get/post`, Next.js `app/` or `pages/` dirs | List of `{method, path, file}` |
| `_extract_models` | Grep for `class.*Base.*Model`, `mapped_column`, `Mapped[` | List of `{name, fields[], file}` |
| `_extract_schemas` | Grep for `class.*BaseSchema`, Pydantic models | List of `{name, fields[], file}` |
| `_extract_components` | Find `.tsx`/`.jsx` files in `components/` dirs | List of `{name, file, type}` |
| `_extract_pages` | Find files in `pages/` or `app/` Next.js dirs | List of `{route, file}` |
| `_extract_dependencies` | Read `package.json` deps, `pyproject.toml` deps | Dict of `{npm: {}, pip: {}}` |
| `_extract_migrations` | List Alembic `versions/` or Prisma migration dirs | List of `{name, timestamp}` |
| `_extract_configs` | Check for docker-compose, .env.example, CI files | List of `{type, file, exists}` |

**Reuses** existing `StructureAnalyzer._collect_source_files()` patterns and `_SKIP_DIRS` constants.

**Important**: This does NOT read function bodies. For routes, it reads class/decorator signatures. For models, it reads field declarations. This keeps the extraction fast and token-efficient.

---

### Step 4: Create `ProgressMatcherService`

**NEW: `apps/api/services/progress_matcher.py`** (~150 LOC)

Uses Claude API to match tasks against extracted artifacts.

```python
class ProgressMatcherService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def match(self, tasks: list[dict], artifacts: dict) -> dict:
        """Send tasks + artifacts to Claude, get evidence mapping."""
        # 1. Get LLM config via get_llm_config(session)
        # 2. Build prompt with task list + artifacts JSON
        # 3. Call OpenAI AsyncClient (compatible with OpenRouter)
        # 4. Parse structured JSON response
        # 5. Return progress report
```

**LLM Prompt Strategy:**

System prompt:
```
You are a code progress analyzer. Given a list of PM tasks and extracted code
artifacts from a repository, determine which tasks have verifiable evidence
of implementation in the codebase.

For each task, assess:
- verified: true/false — is there clear evidence this task is implemented?
- confidence: 0.0-1.0 — how confident are you?
- artifacts_found: list of specific files/routes/models that serve as evidence
- summary: one-line explanation

If a task has a "verification_criteria" field, use it as the primary indicator
of what to look for. Otherwise, infer from the task title and description.

Return ONLY valid JSON matching this schema: [TaskEvidence schema]
```

User message: task list + artifacts dict (both as JSON)

**Token estimation**: ~5K-15K input tokens (task list ~2K + artifacts ~10K), ~3K output tokens. Well within single API call.

---

### Step 5: Create `ScanService` (Orchestrator)

**NEW: `apps/api/services/scan_service.py`** (~120 LOC)

Orchestrates scan lifecycle — creating jobs, fetching results.

```python
class ScanService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def trigger_high_level_scan(self, product_id: UUID, user_id: str) -> Job:
        """Create a job and enqueue the high-level scan."""
        # 1. Validate product exists and has repo linked
        # 2. Check no scan already running for this product
        # 3. Create Job via JobService.create_and_enqueue(
        #        job_type="high_level_scan",
        #        product_id=product_id,
        #        user_id=user_id,
        #        function_name="high_level_scan_job"
        #    )
        # 4. Return job

    async def get_latest_scan_result(self, product_id: UUID) -> RepositoryAnalysis | None:
        """Get the most recent scan result for a product."""
        # Query RepositoryAnalysis ordered by created_at DESC

    async def get_scan_history(self, product_id: UUID, page: int, page_size: int) -> dict:
        """Paginated scan history."""
        # Query RepoScanHistory for product
```

---

### Step 6: Create Arq Job — `high_level_scan_job`

**MODIFY: `apps/api/jobs/tasks.py`** — add new job function (~70 LOC)

```python
async def high_level_scan_job(ctx: dict, job_id_str: str) -> None:
    """High-level repo scan: extract artifacts, match to tasks, update progress."""
    jctx = JobContext()
    tmp_dir = None
    try:
        session = await jctx.get_session()
        job = await session.get(Job, UUID(job_id_str))
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
        tasks = await task_svc.list_tasks(product_id=product_id)
        task_dicts = [serialize_task_for_scan(t) for t in tasks["data"]]

        # 70% — AI matching
        await jctx.update_progress(job_id, 70, "Analyzing progress with AI")
        matcher = ProgressMatcherService(session)
        result = await matcher.match(task_dicts, artifacts)

        # 85% — Store results
        await jctx.update_progress(job_id, 85, "Saving scan results")
        # Save to RepositoryAnalysis (functional_inventory, gap_analysis, structure_map)
        # Update RepoScanHistory with commit_sha, files data
        # Update Product.progress with calculated percentage

        # 100% — Done
        await jctx.mark_completed(job_id, result_data=result)
    except Exception as exc:
        await jctx.mark_failed(job_id, str(exc))
    finally:
        if tmp_dir:
            RepoCloneService.cleanup(tmp_dir)
        await jctx.close()
```

**MODIFY: `apps/api/jobs/worker.py`** — register the new job:
```python
from apps.api.jobs.tasks import generate_system_docs_job, high_level_scan_job

class WorkerSettings:
    functions = [generate_system_docs_job, high_level_scan_job]
```

---

### Step 7: API Endpoints

**NEW: `apps/api/routers/scans.py`** (~80 LOC)

```python
router = APIRouter(prefix="/scans", tags=["scans"])

@router.post("/{product_id}/high-level")      # Trigger scan → returns Job
@router.get("/{product_id}/latest")            # Latest scan result
@router.get("/{product_id}/history")           # Paginated scan history
@router.get("/{product_id}/progress-summary")  # Quick summary (progress %, last scan time)
```

**MODIFY: `apps/api/main.py`** — register scans router

---

### Step 8: Auto-Trigger on Push (Webhook Integration)

**MODIFY: `apps/api/services/github_webhook_service.py`** (~10 lines added)

After the existing doc regeneration in `handle_push_event()`, also trigger a high-level scan:

```python
async def handle_push_event(self, payload: dict) -> dict | None:
    # ... existing product matching and doc regeneration ...

    # NEW: Auto-trigger high-level scan
    from apps.api.services.scan_service import ScanService
    scan_svc = ScanService(self.session)
    await scan_svc.trigger_high_level_scan(
        product_id=product.id,
        user_id="system",  # webhook-triggered, no user context
    )

    return { ... existing response + scan_triggered: True }
```

---

### Step 9: Scan Prompt Templates

**NEW: `apps/api/services/scan_prompts.py`** (~80 LOC)

Centralized prompt templates (following the existing `llm_config.py` pattern):

```python
HIGH_LEVEL_SYSTEM_PROMPT = """You are a code progress analyzer for a project management tool..."""

TASK_EVIDENCE_SCHEMA = """{ "task_id": "uuid", "verified": bool, "confidence": float, ... }"""

# Also register in DEFAULT_PROMPTS if we want it customizable via OrgSetting
```

---

### Step 10: Frontend (Types + Repository + Hooks)

**NEW: `apps/web/src/lib/types/scan.ts`**
```typescript
interface ScanResult {
  scan_summary: {
    total_tasks: number;
    verified: number;
    partial: number;
    no_evidence: number;
    progress_pct: number;
  };
  task_evidence: TaskEvidence[];
  scanned_at: string;
  commit_sha: string;
}

interface TaskEvidence {
  task_id: string;
  task_title: string;
  status_in_pm: string;
  verified: boolean;
  confidence: number;
  artifacts_found: string[];
  summary: string;
}

interface ScanHistoryEntry { ... }
```

**NEW: `apps/web/src/lib/api/repositories/scans.repository.ts`**
```typescript
class ScansRepository extends BaseRepository<ScanResult> {
  basePath = "/scans";
  triggerHighLevel(productId: string): Promise<Job>;
  getLatest(productId: string): Promise<ScanResult>;
  getHistory(productId: string, params?): Promise<PaginatedResponse<ScanHistoryEntry>>;
  getProgressSummary(productId: string): Promise<ProgressSummary>;
}
```

**NEW: `apps/web/src/hooks/mutations/useScanMutations.ts`**
- `useTriggerHighLevelScan(productId)` — triggers scan, shows toast, polls job progress

**NEW: `apps/web/src/hooks/queries/useScans.ts`**
- `useScanResult(productId)` — latest scan result
- `useScanHistory(productId)` — paginated history
- `useProgressSummary(productId)` — lightweight summary for dashboard

**UI Components** (location TBD based on existing product detail page):
- Progress bar with verified/partial/missing breakdown
- "Scan Now" button (triggers manual scan)
- Task evidence table (expandable per task)
- Last scan timestamp + commit SHA

---

## Files Changed Summary

| File | Action | LOC Est. |
|------|--------|----------|
| `apps/api/models/task.py` | Modify — add `verification_criteria` field | +3 |
| `apps/api/schemas/tasks.py` | Modify — add field to Base/Update/Response | +3 |
| `apps/api/services/repo_clone_service.py` | **New** — PAT-authenticated clone | ~60 |
| `apps/api/services/artifact_extractor.py` | **New** — extract routes, models, components | ~200 |
| `apps/api/services/progress_matcher.py` | **New** — AI task-to-artifact matching | ~150 |
| `apps/api/services/scan_service.py` | **New** — orchestrator | ~120 |
| `apps/api/services/scan_prompts.py` | **New** — prompt templates | ~80 |
| `apps/api/routers/scans.py` | **New** — API endpoints | ~80 |
| `apps/api/jobs/tasks.py` | Modify — add `high_level_scan_job` | +70 |
| `apps/api/jobs/worker.py` | Modify — register new job | +2 |
| `apps/api/services/github_webhook_service.py` | Modify — auto-trigger scan | +10 |
| `apps/api/main.py` | Modify — register scans router | +2 |
| `apps/web/src/lib/types/task.ts` | Modify — add `verification_criteria` | +1 |
| `apps/web/src/lib/types/scan.ts` | **New** — scan types | ~40 |
| `apps/web/src/lib/api/repositories/scans.repository.ts` | **New** — API client | ~40 |
| `apps/web/src/hooks/mutations/useScanMutations.ts` | **New** — trigger mutation | ~30 |
| `apps/web/src/hooks/queries/useScans.ts` | **New** — query hooks | ~40 |
| Alembic migration | **New** — add verification_criteria column | auto |

**Total new code**: ~950 LOC across ~10 new files + 6 modified files

---

## Verification Plan

1. **Manual test**: Link a product to a known GitHub repo (e.g., this MIZANOS repo itself)
2. **Add tasks** that match known code: "Create auth API" → should find `routers/auth.py`
3. **Add tasks** that don't exist: "Add payment integration" → should show no evidence
4. **Trigger scan** from API: `POST /scans/{product_id}/high-level`
5. **Verify results**: Check `RepositoryAnalysis.functional_inventory` and `gap_analysis` have correct data
6. **Verify progress**: Check `Product.progress` updated correctly
7. **Webhook test**: Push to tracked branch → verify scan auto-triggers
8. **Run existing tests**: `make test-api` (ensure no regressions)

---

## Future: Deep Scan (Phase 2)

Once high-level scan is working, deep scan adds:
- Full file reading (function internals, not just signatures)
- Quality scoring per task (security, error handling, tests)
- Claude Code CLI in Docker/OpenClaw for interactive analysis
- `Product.health_score` auto-updated from deep scan results
- Stores in `RepositoryAnalysis.code_critique` and `standards_compliance`
