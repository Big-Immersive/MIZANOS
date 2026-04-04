"use client";

import { useState, useMemo, useEffect, useCallback } from "react";

import { Card, CardContent } from "@/components/atoms/display/Card";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { Button } from "@/components/molecules/buttons/Button";
import { SearchableSelect } from "@/components/molecules/forms/SearchableSelect";
import { MarketingTaskDrawer } from "./MarketingTaskDrawer";
import { AddMarketingTaskDialog } from "./AddMarketingTaskDialog";
import { MarketingTaskRow } from "./MarketingTaskRow";
import { useMarketingTasks } from "@/hooks/queries/useMarketingTasks";
import { useProductMembers } from "@/hooks/queries/useProductMembers";
import { useProjectChecklists } from "@/hooks/queries/useProjectChecklists";
import {
  useCreateMarketingTask,
  useUpdateMarketingTask,
  useDeleteMarketingTask,
} from "@/hooks/mutations/useMarketingTaskMutations";
import { MARKETING_TASK_STATUS_DISPLAY, MARKETING_TASK_STATUSES } from "@/lib/constants";
import type { Task, MarketingTaskStatus } from "@/lib/types";
import { ListTodo, Plus } from "lucide-react";

interface MarketingTasksSectionProps {
  productId: string;
  prefillTitle?: string;
  onPrefillConsumed?: () => void;
}
type FilterStatus = MarketingTaskStatus | "all";

function MarketingTasksSection({ productId, prefillTitle, onPrefillConsumed }: MarketingTasksSectionProps) {
  const { data: tasks, isLoading } = useMarketingTasks(productId);
  const { data: members = [] } = useProductMembers(productId);
  const { data: gtmChecklists = [] } = useProjectChecklists(productId, "gtm");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const createTask = useCreateMarketingTask(productId);
  const updateTask = useUpdateMarketingTask(productId);
  const deleteTask = useDeleteMarketingTask(productId);

  useEffect(() => {
    if (prefillTitle) {
      setAddOpen(true);
    }
  }, [prefillTitle]);

  const assigneeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) if (m.profile?.full_name) map.set(m.profile_id, m.profile.full_name);
    return map;
  }, [members]);

  const assigneeOptions = useMemo(() => {
    const sortByName = (a: typeof members[0], b: typeof members[0]) =>
      (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? "");
    const marketing = members.filter((m) => m.role === "marketing").sort(sortByName);
    const others = members.filter((m) => m.role !== "marketing").sort(sortByName);
    return [
      ...marketing.map((m) => ({
        value: m.profile_id,
        label: `${m.profile?.full_name ?? m.profile?.email ?? "Unnamed"} (Marketing)`,
      })),
      ...others.map((m) => ({
        value: m.profile_id,
        label: m.profile?.full_name ?? m.profile?.email ?? "Unnamed",
      })),
    ];
  }, [members]);

  const checklistOptions = useMemo(() => {
    return gtmChecklists.flatMap((cl) =>
      cl.items.map((item) => ({ value: item.id, label: `${item.title} (${item.category})` }))
    );
  }, [gtmChecklists]);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "__unassigned__" && t.assignee_id) return false;
        if (assigneeFilter !== "__unassigned__" && t.assignee_id !== assigneeFilter) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, assigneeFilter]);

  const statusCounts = useMemo(() => {
    if (!tasks) return {};
    const counts: Record<string, number> = {};
    for (const t of tasks) counts[t.status ?? "planned"] = (counts[t.status ?? "planned"] ?? 0) + 1;
    return counts;
  }, [tasks]);

  const handleClick = useCallback((task: Task) => {
    setEditTask(task);
    setEditOpen(true);
  }, []);

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium mb-2">No Marketing Tasks</h3>
          <p className="text-sm text-muted-foreground mb-4">Create the first marketing task for this project.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Task</Button>
          <AddMarketingTaskDialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) onPrefillConsumed?.(); }} isLoading={createTask.isPending} assigneeOptions={assigneeOptions}
            checklistOptions={checklistOptions} prefillTitle={prefillTitle} onSubmit={(data) => { createTask.mutate(data, { onSuccess: () => { setAddOpen(false); onPrefillConsumed?.(); } }); }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {MARKETING_TASK_STATUSES.map((status) => {
          const config = MARKETING_TASK_STATUS_DISPLAY[status];
          const Icon = config.icon;
          const active = statusFilter === status;
          return (
            <Card key={status} className={`cursor-pointer hover:bg-accent/50 transition-colors ${active ? "border-primary/40" : ""}`}
              onClick={() => setStatusFilter(active ? "all" : status)}>
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${active ? config.color : "text-muted-foreground"}`} />
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
        <SearchableSelect label="" placeholder="Filter by assignee" options={[
          { value: "all", label: "All assignees" },
          { value: "__unassigned__", label: "Unassigned" },
          ...assigneeOptions,
        ]} value={assigneeFilter} onValueChange={setAssigneeFilter} />
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Task</Button>
      </div>

      <div className="space-y-2">
        {filtered.map((task) => (
          <MarketingTaskRow
            key={task.id}
            task={task}
            assigneeName={task.assignee_id ? assigneeMap.get(task.assignee_id) : undefined}
            onStatusChange={(status) => updateTask.mutate({ id: task.id, status })}
            onDelete={() => deleteTask.mutate(task.id)}
            onClick={() => handleClick(task)}
          />
        ))}
      </div>

      <MarketingTaskDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        task={editTask}
        assigneeOptions={assigneeOptions}
        onSave={(data) => { if (editTask) updateTask.mutate({ id: editTask.id, ...data }); }}
        onDelete={() => { if (editTask) deleteTask.mutate(editTask.id); }}
        isSaving={updateTask.isPending}
      />
      <AddMarketingTaskDialog open={addOpen} onOpenChange={setAddOpen} isLoading={createTask.isPending} assigneeOptions={assigneeOptions}
        onSubmit={(data) => { createTask.mutate(data, { onSuccess: () => setAddOpen(false) }); }} />
    </div>
  );
}

export { MarketingTasksSection };
