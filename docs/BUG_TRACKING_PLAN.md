# Bug Tracking Feature Plan

## Context

The system has project and task management. We need to add bug tracking that reuses the same `tasks` table with a new `task_type` discriminator field. Bugs must be completely separated from tasks across all UI surfaces, counts, and scan functionality. Bugs have their own statuses, their own nav section, their own tab in project detail, and relaxed authorization (anyone can log a bug for any project).

---

## Step 1: Database Migration + Model

**New file:** `infra/alembic/versions/xxxx_add_task_type_to_tasks.py`
- Add column `task_type VARCHAR NOT NULL DEFAULT 'task'` to `tasks` table
- `server_default='task'` auto-backfills existing rows
- Add index on `(product_id, task_type)` for query performance

**Modify:** `apps/api/models/task.py`
- Add `task_type: Mapped[str] = mapped_column(String, nullable=False, server_default="task")`

**Modify:** `apps/api/models/enums.py`
- Add `TaskType` enum: `TASK = "task"`, `BUG = "bug"`
- Add `BugStatus` enum: `REPORTED`, `TRIAGING`, `IN_PROGRESS`, `FIXED`, `VERIFIED`, `REOPENED`, `WONT_FIX`, `LIVE`

---

## Step 2: Backend Schemas

**Modify:** `apps/api/schemas/tasks.py`
- Add `task_type: str = "task"` to `TaskBase`
- Add `task_type: str | None = None` to `TaskUpdate`
- Add `task_type: str` to `TaskResponse`

**Modify:** `apps/api/schemas/products.py`
- Add `bug_count: int = 0` and `bugs_fixed_count: int = 0` to `ProductResponse`

---

## Step 3: Backend Service Changes

**Modify:** `apps/api/services/task_service.py`
- Add `task_type: str = "task"` param to `list_tasks()` → filter `Task.task_type == task_type`
- Add `task_type` param to `list_drafts()` with same filter
- In `create_task()`: if `task_type == "bug"`, skip project membership/manager authorization checks (anyone can log bugs), set default status to `"reported"`
- Add `BUG_STATUSES` constant for validation

**Modify:** `apps/api/services/product_service.py` (lines 100-113)
- Filter existing task_count query: `.where(Task.task_type == "task")`
- Add bug count query:
  ```python
  bug_stmt = select(Task.product_id, func.count(Task.id))
      .where(Task.product_id.in_(product_ids), Task.task_type == "bug")
      .group_by(Task.product_id)
  bug_fixed_stmt = select(Task.product_id, func.count(Task.id))
      .where(Task.product_id.in_(product_ids), Task.task_type == "bug",
             Task.status.in_(["fixed", "verified", "live"]))
      .group_by(Task.product_id)
  ```
- Set `product.bug_count` and `product.bugs_fixed_count`

---

## Step 4: Backend Router + Scan Job

**Modify:** `apps/api/routers/tasks.py`
- Add `task_type: str = Query("task")` param to the list endpoint, pass through to service
- Same for drafts endpoints

**Modify:** `apps/api/jobs/scan_job.py` (line 61)
- Add `task_type="task"` to `list_tasks()` call to exclude bugs from scan verification

---

## Step 5: Frontend Types & Constants

**Modify:** `apps/web/src/lib/types/enums.ts`
- Add `TaskType = "task" | "bug"`
- Add `BugStatus = "reported" | "triaging" | "in_progress" | "fixed" | "verified" | "reopened" | "wont_fix" | "live"`

**Modify:** `apps/web/src/lib/types/task.ts`
- Add `task_type: string;` to `Task` interface

**Modify:** `apps/web/src/lib/types/product.ts`
- Add `bug_count: number;` and `bugs_fixed_count: number;`

**Modify:** `apps/web/src/lib/constants/tasks.ts`
- Add `BUG_STATUS_DISPLAY` record with icons/colors for each bug status:
  - reported (AlertCircle, red), triaging (Search, orange), in_progress (Clock, yellow)
  - fixed (CheckCircle2, green), verified (ShieldCheck, emerald), reopened (RotateCcw, red)
  - wont_fix (Ban, muted), live (Rocket, blue)
- Add `BUG_STATUSES` array constant

---

## Step 6: Frontend Repository + Hooks

**Modify:** `apps/web/src/lib/api/repositories/tasks.repository.ts`
- Add `getBugsByProduct(productId, params)` → calls `getAll({ ...params, product_id, task_type: "bug" })`
- Existing `getByProduct` → add `task_type: "task"` to params

**Modify:** `apps/web/src/hooks/queries/useTasks.ts`
- `useTasks`: pass `task_type: "task"` in the params to ensure only tasks returned

**Modify:** `apps/web/src/hooks/queries/useAllTasks.ts`
- Add `task_type: "task"` to default filters

**New file:** `apps/web/src/hooks/queries/useBugs.ts`
- `useBugs(productId)`: query key `["bugs", productId]`, calls `tasksRepository.getBugsByProduct()`
- `useBugsByAssignee(assigneeId)`: query key `["bugs", "assignee", assigneeId]`

**New file:** `apps/web/src/hooks/queries/useAllBugs.ts`
- `useAllBugs(filters)`: query key `["bugs", "all", cleanFilters]`, calls `tasksRepository.getAll({ ...filters, task_type: "bug" })`

**New file:** `apps/web/src/hooks/mutations/useBugMutations.ts`
- `useCreateBug(productId)`: creates with `task_type: "bug"`, `status: "reported"`, invalidates `["bugs", ...]`
- `useUpdateBug(productId)`: invalidates `["bugs", ...]`
- `useDeleteBug(productId)`: invalidates `["bugs", ...]`

---

## Step 7: Make Shared Components Configurable

**Modify:** `apps/web/src/components/molecules/tasks/TaskRow.tsx`
- Add optional `statusDisplay?: Record<string, TaskStatusConfig>` prop (default: `TASK_STATUS_DISPLAY`)

**Modify:** `apps/web/src/components/organisms/tasks/TasksFilterBar.tsx`
- Add optional `statusOptions?: readonly string[]` prop (default: `TASK_STATUSES`)
- Add optional `statusDisplay?: Record<string, TaskStatusConfig>` prop

**Modify:** `apps/web/src/components/organisms/product/TaskDetailDrawer.tsx`
- Make status dropdown options configurable based on `task.task_type`
- Show bug statuses when editing a bug, task statuses when editing a task

---

## Step 8: Bug Tab in Project Detail

**New file:** `apps/web/src/components/organisms/product/BugsTab.tsx`
- Same structure as `TasksTab.tsx` but uses:
  - `useBugs(productId)` hook
  - `BUG_STATUS_DISPLAY` and `BUG_STATUSES` for filters
  - `useCreateBug` mutation
  - Status filter cards: Reported, Triaging, In Progress, Fixed, Verified, Live
  - Passes `statusDisplay={BUG_STATUS_DISPLAY}` to `TaskRow`
  - "Report Bug" button instead of "Add Task"

**New file:** `apps/web/src/components/organisms/kanban/AddBugDialog.tsx`
- Simplified version of `AddTaskDialog`
- Fields: title, description, priority (no pillar)
- Default status: "reported", task_type: "bug"

**Modify:** `apps/web/src/components/organisms/product/ProductTabs.tsx`
- Add "Bugs" tab (Bug icon from lucide-react) after Tasks tab
- Accept `bugsContent` prop

**Modify:** `apps/web/src/app/(app)/projects/[id]/page.tsx`
- Import and render `<BugsTab>` as `bugsContent`

---

## Step 9: Global Bugs Page + Navigation

**New file:** `apps/web/src/app/(app)/bugs/page.tsx`
- Same structure as `/tasks/page.tsx`
- Uses `useAllBugs(filters)` hook
- Bug-specific status summary cards at top
- Reuses `TasksFilterBar` with `statusOptions={BUG_STATUSES}` and `statusDisplay={BUG_STATUS_DISPLAY}`
- Reuses `TaskRow` with `statusDisplay={BUG_STATUS_DISPLAY}`
- "Report Bug" button for any project

**Modify:** `apps/web/src/lib/constants/navigation.ts`
- Add `{ href: "/bugs", icon: Bug, label: "Bugs" }` after Tasks in the MANAGE section

---

## Step 10: Product Card Bug Count

**Modify:** `apps/web/src/components/molecules/product/ProductCard.tsx`
- Show bug count as `{bugs_fixed_count}/{bug_count} fixed` with Bug icon when `bug_count > 0`

**Modify:** `apps/web/src/components/molecules/product/ProductRow.tsx`
- Add bug count column showing `fixed/total` format

---

## Files Summary

### New files (7):
1. `infra/alembic/versions/xxxx_add_task_type_to_tasks.py` — migration
2. `apps/web/src/hooks/queries/useBugs.ts` — bug query hooks
3. `apps/web/src/hooks/queries/useAllBugs.ts` — global bug query hook
4. `apps/web/src/hooks/mutations/useBugMutations.ts` — bug mutations
5. `apps/web/src/components/organisms/product/BugsTab.tsx` — project bugs tab
6. `apps/web/src/components/organisms/kanban/AddBugDialog.tsx` — bug creation dialog
7. `apps/web/src/app/(app)/bugs/page.tsx` — global bugs page

### Modified files (18):
1. `apps/api/models/enums.py` — TaskType, BugStatus enums
2. `apps/api/models/task.py` — task_type column
3. `apps/api/schemas/tasks.py` — task_type in schemas
4. `apps/api/schemas/products.py` — bug_count, bugs_fixed_count
5. `apps/api/services/task_service.py` — task_type filter + bug auth rules
6. `apps/api/services/product_service.py` — bug count queries
7. `apps/api/routers/tasks.py` — task_type query param
8. `apps/api/jobs/scan_job.py` — exclude bugs from scan
9. `apps/web/src/lib/types/enums.ts` — TaskType, BugStatus types
10. `apps/web/src/lib/types/task.ts` — task_type field
11. `apps/web/src/lib/types/product.ts` — bug_count, bugs_fixed_count
12. `apps/web/src/lib/constants/tasks.ts` — BUG_STATUS_DISPLAY, BUG_STATUSES
13. `apps/web/src/lib/constants/navigation.ts` — Bugs nav item
14. `apps/web/src/lib/api/repositories/tasks.repository.ts` — bug helper methods
15. `apps/web/src/hooks/queries/useTasks.ts` — add task_type="task" filter
16. `apps/web/src/hooks/queries/useAllTasks.ts` — add task_type="task" filter
17. `apps/web/src/components/molecules/tasks/TaskRow.tsx` — configurable statusDisplay prop
18. `apps/web/src/components/organisms/tasks/TasksFilterBar.tsx` — configurable status options
19. `apps/web/src/components/organisms/product/TaskDetailDrawer.tsx` — bug-aware status dropdown
20. `apps/web/src/components/organisms/product/ProductTabs.tsx` — Bugs tab
21. `apps/web/src/app/(app)/projects/[id]/page.tsx` — wire BugsTab
22. `apps/web/src/components/molecules/product/ProductCard.tsx` — bug count display
23. `apps/web/src/components/molecules/product/ProductRow.tsx` — bug count column

---

## Verification

1. `make db-migrate` — migration runs cleanly
2. `make dev` — both servers start
3. Create a bug via the Bugs tab → verify it appears in bugs list, NOT in tasks list
4. Create a task → verify it appears in tasks list, NOT in bugs list
5. Check project card → task count excludes bugs, bug count shows fixed/total
6. Run a scan → verify only tasks (not bugs) are included in scan verification
7. Check ProductOverview health score → excludes bugs
8. Navigate to `/bugs` → verify global bug list with filters
9. Verify anyone can log a bug (no project membership required)
10. `make test-api && make test-web` — existing tests pass
11. `make typecheck && make lint` — no type errors
