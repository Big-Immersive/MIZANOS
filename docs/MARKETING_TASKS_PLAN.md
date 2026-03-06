# Marketing Tasks with Subtasks

## Context
The marketing tab currently only manages assets (domains, social handles, credentials, checklist). The user wants a task management section added inside the marketing tab — using the same `tasks` table with a third discriminator value `marketing_task`. Marketing tasks support one level of subtasks (parent → child) via a self-referencing `parent_id` column. Subtasks have their own status tracking. The marketing tab should also be repositioned next to System Docs in the project tab order.

**Statuses**: Planned → In Execution → Completed
**Subtasks**: Own status tracking (same 3 statuses), single-level nesting only
**Placement**: New "Tasks" sub-tab inside the existing Marketing tab

---

## Backend Changes

### 1. Enums — `apps/api/models/enums.py`
- Add `MARKETING_TASK = "marketing_task"` to `TaskType`
- Add `MarketingTaskStatus` enum: `PLANNED`, `IN_EXECUTION`, `COMPLETED`

### 2. Task Model — `apps/api/models/task.py`
- Add `parent_id` column: nullable UUID, FK to `tasks.id`, `ondelete="CASCADE"`
- Add `subtasks` relationship (list, back_populates="parent", cascade delete)
- Add `parent` relationship (back_populates="subtasks", remote_side=[id])

### 3. Alembic Migration — `infra/alembic/versions/`
- Add `parent_id` column (UUID, nullable, FK → tasks.id CASCADE)
- Add index on `parent_id`

### 4. Schemas — `apps/api/schemas/tasks.py`
- Add `parent_id: UUID | None = None` to `TaskBase` and `TaskResponse`
- Add `subtask_count: int = 0` to `TaskResponse`

### 5. Service — `apps/api/services/task_service.py`
- `list_tasks()`: When `task_type="marketing_task"`, filter `parent_id IS NULL` (exclude subtasks from top-level)
- New `list_subtasks(parent_id)`: Returns tasks where `parent_id == parent_id`
- `create_task()`: For `marketing_task`, default status to `"planned"`. If `parent_id` provided, validate parent exists and is a top-level marketing task (no nested subtasks)
- Scan job already filters `task_type="task"` — no change needed

### 6. Router — `apps/api/routers/tasks.py`
- Add `GET /{task_id}/subtasks` endpoint → calls `service.list_subtasks()`

---

## Frontend Changes

### 7. Types — `apps/web/src/lib/types/enums.ts`
- Update `TaskType` to include `"marketing_task"`
- Add `MarketingTaskStatus = "planned" | "in_execution" | "completed"`

### 8. Task Type — `apps/web/src/lib/types/task.ts`
- Add `parent_id: string | null` and `subtask_count: number` to Task interface

### 9. Constants — `apps/web/src/lib/constants/tasks.ts`
- Add `MARKETING_TASK_STATUS_DISPLAY` (3 entries: planned, in_execution, completed)
- Add `MARKETING_TASK_STATUSES` array
- Export from `constants/index.ts`

### 10. Repository — `apps/web/src/lib/api/repositories/tasks.repository.ts`
- Add `getMarketingTasksByProduct(productId)` — passes `task_type: "marketing_task"`
- Add `getSubtasks(parentId)` — calls `GET /tasks/{parentId}/subtasks`

### 11. Query Hooks — `apps/web/src/hooks/queries/useMarketingTasks.ts` (NEW)
- `useMarketingTasks(productId)` — query key `["marketing-tasks", productId]`
- `useSubtasks(parentId)` — query key `["subtasks", parentId]`, fetched lazily on expand

### 12. Mutation Hooks — `apps/web/src/hooks/mutations/useMarketingTaskMutations.ts` (NEW)
- `useCreateMarketingTask(productId)` — sets `task_type: "marketing_task"`, status: `"planned"`
- `useCreateSubtask(productId, parentId)` — same + sets `parent_id`
- `useUpdateMarketingTask(productId)` — invalidates marketing-tasks + subtasks
- `useDeleteMarketingTask(productId)` — invalidates marketing-tasks + subtasks

### 13. Components (NEW)

**`apps/web/src/components/organisms/marketing/AddMarketingTaskDialog.tsx`** (~130 LOC)
- Fields: Title, Description, Status (default: Planned), Assignee (searchable), Due Date
- `isSubtask` prop to change dialog title
- Uses `SearchableSelect` (`components/molecules/forms/SearchableSelect.tsx`) for assignee dropdown with search

**`apps/web/src/components/organisms/marketing/MarketingTaskRow.tsx`** (~100 LOC)
- Wraps `TaskRow` with expand/collapse chevron for subtasks
- Expanded state: fetches subtasks via `useSubtasks`, renders indented rows + "Add Subtask" button

**`apps/web/src/components/organisms/marketing/MarketingTasksSection.tsx`** (~180 LOC)
- 3 status summary cards (Planned, In Execution, Completed)
- Status + assignee filters
- List of `MarketingTaskRow` components
- "Add Task" button → `AddMarketingTaskDialog`
- Reuses `TaskDetailDrawer` with `taskType="marketing_task"`

### 14. Update MarketingTab — `apps/web/src/components/organisms/marketing/MarketingTab.tsx`
- Add `{ id: "tasks", label: "Tasks", icon: ListTodo }` to `TABS` array
- Render `<MarketingTasksSection productId={productId} />` for "tasks" tab
- Update `TabId` type

### 14b. Assignee Ordering for Marketing Tasks
- In `MarketingTasksSection` and `AddMarketingTaskDialog`, build the assignee list with **marketing-role members first**:
  - Members with `role === "marketing"` (from `ProductMemberRole`) shown at top, labeled with a group header or "(Marketing)" suffix
  - Then all other project members below
- Use `SearchableSelect` (existing component at `components/molecules/forms/SearchableSelect.tsx`) for the assignee dropdown — it already has built-in search filtering
- Also applies to the assignee filter dropdown in `MarketingTasksSection`

### 15. Update TaskDetailDrawer — `apps/web/src/components/organisms/product/TaskDetailDrawer.tsx`
- Add `MARKETING_TASK_STATUS_OPTIONS` (planned, in_execution, completed)
- Handle `taskType="marketing_task"` in status options selection
- Hide Pillar dropdown for marketing tasks (not relevant)
- Extract status option arrays to `constants/tasks.ts` if LOC limit is tight

### 16. Reposition Marketing Tab — `apps/web/src/components/organisms/product/ProductTabs.tsx`
- Move marketing tab entry from position 14 (after Features) to position 8 (after System Docs)

---

## Verification
1. `make typecheck` — passes
2. Run Alembic migration — `parent_id` column added
3. Start API → test `POST /tasks` with `task_type: "marketing_task"` and `parent_id`
4. Start web → project detail → Marketing tab → "Tasks" sub-tab visible
5. Create marketing task → appears in list with "Planned" status
6. Expand task → "Add Subtask" → create subtask → appears nested under parent
7. Change subtask status independently from parent
8. Delete parent → subtasks cascade-deleted
9. Marketing tasks do NOT appear in project Tasks tab or Bugs tab
10. Marketing tab appears next to System Docs in tab bar
