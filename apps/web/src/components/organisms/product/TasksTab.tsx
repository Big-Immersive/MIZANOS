"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { Button } from "@/components/molecules/buttons/Button";
import { BulkActionsToolbar } from "@/components/molecules/tasks/BulkActionsToolbar";
import { TaskRow } from "@/components/molecules/tasks/TaskRow";
import { TaskDetailDrawer } from "@/components/organisms/product/TaskDetailDrawer";
import { AddTaskDialog } from "@/components/organisms/kanban/AddTaskDialog";
import { toKanbanTask } from "@/components/organisms/kanban/kanban-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/queries/useTasks";
import { useProductMembers } from "@/hooks/queries/useProductMembers";
import { useCreateTask, useUpdateTask } from "@/hooks/mutations/useTaskMutations";
import { useQuery } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import { useMilestones } from "@/hooks/queries/useMilestones";
import { useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from "@/hooks/mutations/useMilestoneMutations";
import { TASK_STATUS_DISPLAY } from "@/lib/constants";
import type { KanbanTask, TaskStatus, TaskPriority } from "@/lib/types";
import type { Milestone } from "@/lib/types/milestone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/inputs/BaseSelect";
import { Badge } from "@/components/atoms/display/Badge";
import { ChevronDown, ChevronRight, Filter, FolderOpen, ListTodo, Pencil, Plus, Trash2, User } from "lucide-react";

interface TasksTabProps { productId: string; openTaskId?: string }
type FilterStatus = TaskStatus | "all";
type FilterPriority = TaskPriority | "all";

function TasksTab({ productId, openTaskId }: TasksTabProps) {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useTasks(productId);
  const { data: members = [] } = useProductMembers(productId);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [editTask, setEditTask] = useState<KanbanTask | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [addTaskMilestoneId, setAddTaskMilestoneId] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDesc, setMilestoneDesc] = useState("");
  const [milestonePillar, setMilestonePillar] = useState("development");
  const [milestonePriority, setMilestonePriority] = useState("medium");
  const [milestoneStatus, setMilestoneStatus] = useState("backlog");
  const [milestoneAssignees, setMilestoneAssignees] = useState<string[]>([]);
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [milestoneCreatedDate, setMilestoneCreatedDate] = useState("");
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(new Set());
  const [deleteMilestoneId, setDeleteMilestoneId] = useState<string | null>(null);
  const { data: milestones = [] } = useMilestones(productId);
  const deleteMilestoneData = milestones.find((m) => m.id === deleteMilestoneId);
  const createMilestone = useCreateMilestone(productId);
  const deleteMilestone = useDeleteMilestone(productId);
  const updateMilestone = useUpdateMilestone(productId);
  const createTask = useCreateTask(productId);
  const updateTask = useUpdateTask(productId);

  const handleStatusChange = useCallback((taskId: string, status: string) => {
    updateTask.mutate({ id: taskId, status });
  }, [updateTask]);

  const assigneeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.profile?.full_name) map.set(m.profile_id, m.profile.full_name);
    }
    return map;
  }, [members]);

  const taskIds = useMemo(() => tasks?.map((t) => t.id) ?? [], [tasks]);
  const { data: checklistAssigneesMap = {} } = useQuery({
    queryKey: ["checklist-assignees", productId, taskIds.length],
    queryFn: () => tasksRepository.getChecklistAssignees(taskIds),
    enabled: taskIds.length > 0,
    staleTime: 30_000,
  });

  const handledTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (openTaskId && tasks && !isLoading && handledTaskIdRef.current !== openTaskId) {
      const task = tasks.find((t) => t.id === openTaskId);
      if (task) {
        handledTaskIdRef.current = openTaskId;
        setEditTask(toKanbanTask(task, assigneeMap));
        setEditDialogOpen(true);
      }
    }
  }, [openTaskId, tasks, isLoading, assigneeMap]);

  const STATUS_SORT_ORDER: Record<string, number> = {
    in_progress: 0, review: 1, backlog: 2, done: 3, live: 4, cancelled: 5,
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((task) => {
        if (myTasksOnly && user?.profile_id && task.assignee_id !== user.profile_id && task.created_by !== user.profile_id) return false;
        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
        if (!myTasksOnly) {
          if (assigneeFilter === "__unassigned__" && task.assignee_id) return false;
          if (assigneeFilter !== "all" && assigneeFilter !== "__unassigned__" && task.assignee_id !== assigneeFilter) return false;
        }
        return true;
      })
      .sort((a, b) => (STATUS_SORT_ORDER[a.status ?? "backlog"] ?? 9) - (STATUS_SORT_ORDER[b.status ?? "backlog"] ?? 9));
  }, [tasks, statusFilter, priorityFilter, assigneeFilter, myTasksOnly, user?.profile_id]);

  const tasksByMilestone = useMemo(() => {
    const map = new Map<string, typeof filteredTasks>();
    for (const t of filteredTasks) {
      const mid = t.milestone_id ?? "ungrouped";
      if (!map.has(mid)) map.set(mid, []);
      map.get(mid)!.push(t);
    }
    return map;
  }, [filteredTasks]);

  const toggleMilestoneCollapse = useCallback((id: string) => {
    setCollapsedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetMilestoneForm = () => {
    setMilestoneTitle(""); setMilestoneDesc(""); setMilestonePillar("development");
    setMilestonePriority("medium"); setMilestoneStatus("backlog"); setMilestoneAssignees([]);
    setMilestoneDueDate("");
    setMilestoneCreatedDate("");
    setEditingMilestoneId(null); setAddMilestoneOpen(false);
  };

  const handleCreateMilestone = () => {
    if (!milestoneTitle.trim()) return;
    const data = {
      title: milestoneTitle.trim(),
      description: milestoneDesc.trim() || undefined,
      pillar: milestonePillar,
      priority: milestonePriority,
      status: milestoneStatus,
      assignee_ids: milestoneAssignees.length > 0 ? milestoneAssignees : undefined,
      assignee_id: milestoneAssignees[0] || null,
      due_date: milestoneDueDate ? new Date(milestoneDueDate).toISOString() : null,
      ...(milestoneCreatedDate ? { created_at: new Date(milestoneCreatedDate).toISOString() } : {}),
    };
    if (editingMilestoneId) {
      updateMilestone.mutate({ id: editingMilestoneId, ...data }, { onSuccess: resetMilestoneForm });
    } else {
      createMilestone.mutate(data, { onSuccess: resetMilestoneForm });
    }
  };

  const openEditMilestone = (m: Milestone) => {
    setEditingMilestoneId(m.id);
    setMilestoneTitle(m.title);
    setMilestoneDesc(m.description ?? "");
    setMilestonePillar(m.pillar ?? "development");
    setMilestonePriority(m.priority ?? "medium");
    setMilestoneStatus(m.status ?? "backlog");
    setMilestoneAssignees(m.assignee_ids ?? (m.assignee_id ? [m.assignee_id] : []));
    setMilestoneDueDate(m.due_date ? m.due_date.slice(0, 10) : "");
    setMilestoneCreatedDate(m.created_at ? m.created_at.slice(0, 10) : "");
    setAddMilestoneOpen(true);
  };

  const toggleAssignee = (id: string) => {
    setMilestoneAssignees((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  }, [filteredTasks, selectedIds.size]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const statusCounts = useMemo(() => {
    if (!tasks) return {};
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const s = task.status ?? "backlog";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Tasks Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first task to get started.</p>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
          <AddTaskDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            defaultStatus="backlog"
            productId={productId}
            isLoading={createTask.isPending}
            onSubmit={(data) => {
              createTask.mutate(data, { onSuccess: () => setAddDialogOpen(false) });
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {(["backlog", "in_progress", "review", "done", "live"] as TaskStatus[]).map((status) => {
          const config = TASK_STATUS_DISPLAY[status];
          const Icon = config.icon;
          return (
            <Card key={status} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}>
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${statusFilter === status ? config.color : "text-muted-foreground"}`} />
                <div>
                  <p className="text-lg font-semibold tabular-nums">{statusCounts[status] ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Priority:</span>
        {(["all", "low", "medium", "high"] as const).map((priority) => (
          <Button
            key={priority}
            variant={priorityFilter === priority ? "default" : "outline"}
            size="sm"
            onClick={() => setPriorityFilter(priority)}
            className="text-xs capitalize"
          >
            {priority}
          </Button>
        ))}
        <Button
          variant={myTasksOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setMyTasksOnly((prev) => !prev)}
          className="text-xs ml-2"
        >
          <User className="h-3 w-3 mr-1" /> My Tasks
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Assignee:</span>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {Array.from(new Map(members.map((m) => [m.profile_id, m])).values()).map((m) => (
                <SelectItem key={m.profile_id} value={m.profile_id}>
                  {m.profile?.full_name ?? m.profile?.email ?? "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </span>
          <Button size="sm" variant="outline" onClick={() => setAddMilestoneOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Milestone
          </Button>
        </div>
      </div>

      <BulkActionsToolbar
        taskCount={filteredTasks.length}
        selectedIds={selectedIds}
        onToggleAll={toggleSelectAll}
        onClearSelection={clearSelection}
        productId={productId}
      />

      <div className="space-y-4">
        {milestones.map((milestone) => {
          const milestoneTasks = tasksByMilestone.get(milestone.id) ?? [];
          const isCollapsed = collapsedMilestones.has(milestone.id);
          return (
            <div key={milestone.id} className="rounded-lg border">
              <div
                className="flex items-center gap-2 px-3 py-2.5 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => toggleMilestoneCollapse(milestone.id)}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{milestone.title}</span>
                {(milestone.assignee_ids?.length ? milestone.assignee_ids : milestone.assignee_id ? [milestone.assignee_id] : []).map((aid) => (
                  assigneeMap.get(aid) ? (
                    <span key={aid} className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                      <User className="h-2.5 w-2.5" /> {assigneeMap.get(aid)}
                    </span>
                  ) : null
                ))}
                <span className="flex-1" />
                <Badge variant="secondary" className="text-[10px]">{milestoneTasks.length} tasks</Badge>
                <button type="button" onClick={(e) => { e.stopPropagation(); openEditMilestone(milestone); }} className="p-1 rounded hover:bg-accent">
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteMilestoneId(milestone.id); }} className="p-1 rounded hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setAddTaskMilestoneId(milestone.id); setAddDialogOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" /> Add Task
                </Button>
              </div>
              {milestone.description && !isCollapsed && (
                <p className="text-xs text-muted-foreground px-3 py-1 border-b">{milestone.description}</p>
              )}
              {!isCollapsed && (
                <div className="p-1.5 space-y-1">
                  {milestoneTasks.length > 0 ? milestoneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      selected={selectedIds.has(task.id)}
                      assigneeName={task.assignee_id ? assigneeMap.get(task.assignee_id) : undefined}
                      checklistAssignees={checklistAssigneesMap[task.id]}
                      onToggle={() => toggleSelect(task.id)}
                      onClick={() => { setEditTask(toKanbanTask(task, assigneeMap)); setEditDialogOpen(true); }}
                      onStatusChange={handleStatusChange}
                    />
                  )) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No tasks in this milestone</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Show ungrouped tasks if any */}
        {(tasksByMilestone.get("ungrouped")?.length ?? 0) > 0 && (
          <div className="space-y-1">
            {tasksByMilestone.get("ungrouped")!.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={selectedIds.has(task.id)}
                assigneeName={task.assignee_id ? assigneeMap.get(task.assignee_id) : undefined}
                checklistAssignees={checklistAssigneesMap[task.id]}
                onToggle={() => toggleSelect(task.id)}
                onClick={() => { setEditTask(toKanbanTask(task, assigneeMap)); setEditDialogOpen(true); }}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Milestone creation dialog */}
      {addMilestoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-semibold">{editingMilestoneId ? "Edit Milestone" : "Create Milestone"}</h3>
            <div>
              <label className="text-sm font-medium">Title</label>
              <input type="text" value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} placeholder="Milestone title..." className="w-full h-9 px-3 text-sm rounded-md border bg-background mt-1" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea value={milestoneDesc} onChange={(e) => setMilestoneDesc(e.target.value)} placeholder="Optional description..." className="w-full h-20 px-3 py-2 text-sm rounded-md border bg-background mt-1 resize-none" />
            </div>
            <div>
              <label className="text-sm font-medium">Assignees</label>
              <div className="mt-1 max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                {Array.from(new Map(members.map((m) => [m.profile_id, m])).values()).map((m) => {
                  const selected = milestoneAssignees.includes(m.profile_id);
                  return (
                    <label key={m.profile_id} className={`flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer hover:bg-accent ${selected ? "bg-primary/10" : ""}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleAssignee(m.profile_id)} className="rounded" />
                      {m.profile?.full_name ?? m.profile?.email ?? "Unknown"}
                      {m.role && <span className="text-[10px] text-muted-foreground">({m.role})</span>}
                    </label>
                  );
                })}
              </div>
              {milestoneAssignees.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{milestoneAssignees.length} selected</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Business Vertical</label>
                <Select value={milestonePillar} onValueChange={setMilestonePillar}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select value={milestonePriority} onValueChange={setMilestonePriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={milestoneStatus} onValueChange={setMilestoneStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <input
                  type="date"
                  value={milestoneDueDate}
                  onChange={(e) => setMilestoneDueDate(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border bg-background mt-1"
                />
                <p className="text-xs text-muted-foreground mt-0.5">Optional</p>
              </div>
              <div>
                <label className="text-sm font-medium">Created Date</label>
                <input
                  type="date"
                  value={milestoneCreatedDate}
                  onChange={(e) => setMilestoneCreatedDate(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border bg-background mt-1"
                />
                <p className="text-xs text-muted-foreground mt-0.5">Defaults to today if empty</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetMilestoneForm}>Cancel</Button>
              <Button size="sm" onClick={handleCreateMilestone} disabled={!milestoneTitle.trim() || createMilestone.isPending || updateMilestone.isPending}>
                {createMilestone.isPending || updateMilestone.isPending ? "Saving..." : editingMilestoneId ? "Update Milestone" : "Create Milestone"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete milestone confirmation */}
      {deleteMilestoneId && deleteMilestoneData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-destructive">Delete Milestone</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteMilestoneData.title}</strong>?
              All tasks inside this milestone will also be permanently deleted.
            </p>
            <p className="text-sm font-medium">
              {tasksByMilestone.get(deleteMilestoneId)?.length ?? 0} task(s) will be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteMilestoneId(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" disabled={deleteMilestone.isPending} onClick={() => {
                deleteMilestone.mutate(deleteMilestoneId, { onSuccess: () => setDeleteMilestoneId(null) });
              }}>
                {deleteMilestone.isPending ? "Deleting..." : "Delete Milestone & Tasks"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TaskDetailDrawer
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={editTask}
        productId={productId}
      />
      <AddTaskDialog
        open={addDialogOpen}
        onOpenChange={(open) => { setAddDialogOpen(open); if (!open) setAddTaskMilestoneId(null); }}
        defaultStatus="backlog"
        productId={productId}
        isLoading={createTask.isPending}
        onSubmit={(data) => {
          const taskData = addTaskMilestoneId ? { ...data, milestone_id: addTaskMilestoneId } : data;
          createTask.mutate(taskData, { onSuccess: () => { setAddDialogOpen(false); setAddTaskMilestoneId(null); } });
        }}
      />
    </div>
  );
}

export { TasksTab };
export type { TasksTabProps };
