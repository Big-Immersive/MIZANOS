"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { Button } from "@/components/molecules/buttons/Button";
import { BulkActionsToolbar } from "@/components/molecules/tasks/BulkActionsToolbar";
import { TaskRow } from "@/components/molecules/tasks/TaskRow";
import { TaskDetailDrawer } from "@/components/organisms/product/TaskDetailDrawer";
import { AddBugDialog } from "@/components/organisms/kanban/AddBugDialog";
import { toKanbanTask } from "@/components/organisms/kanban/kanban-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useBugs } from "@/hooks/queries/useBugs";
import { useProductMembers } from "@/hooks/queries/useProductMembers";
import { useCreateBug, useUpdateBug, useDeleteBug } from "@/hooks/mutations/useBugMutations";
import { BUG_STATUS_DISPLAY } from "@/lib/constants";
import type { KanbanTask, TaskPriority, BugStatus } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/inputs/BaseSelect";
import { Bug, Filter, Plus, User } from "lucide-react";

interface BugsTabProps { productId: string }
type FilterStatus = BugStatus | "all";
type FilterPriority = TaskPriority | "all";

const STATUS_CARDS: BugStatus[] = ["reported", "triaging", "in_progress", "fixed", "verified", "reopened", "live"];

function BugsTab({ productId }: BugsTabProps) {
  const { user } = useAuth();
  const { data: bugs, isLoading } = useBugs(productId);
  const { data: members = [] } = useProductMembers(productId);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [myBugsOnly, setMyBugsOnly] = useState(false);
  const [editBug, setEditBug] = useState<KanbanTask | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const createBug = useCreateBug(productId);
  const updateBug = useUpdateBug(productId);
  const deleteBug = useDeleteBug(productId);

  const assigneeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.profile?.full_name) map.set(m.profile_id, m.profile.full_name);
    }
    return map;
  }, [members]);

  const assigneeOptions = useMemo(() =>
    [...members]
      .sort((a, b) => (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? ""))
      .map((m) => ({
        value: m.profile_id,
        label: `${m.profile?.full_name ?? m.profile?.email ?? "Unnamed"}${m.role ? ` — ${m.role}` : ""}`,
      })),
  [members]);

  const filteredBugs = useMemo(() => {
    if (!bugs) return [];
    return bugs.filter((bug) => {
      if (myBugsOnly && user?.profile_id && bug.assignee_id !== user.profile_id && bug.created_by !== user.profile_id) return false;
      if (statusFilter !== "all" && bug.status !== statusFilter) return false;
      if (priorityFilter !== "all" && bug.priority !== priorityFilter) return false;
      if (!myBugsOnly && assigneeFilter !== "all") {
        if (assigneeFilter === "__unassigned__" && bug.assignee_id) return false;
        if (assigneeFilter !== "__unassigned__" && bug.assignee_id !== assigneeFilter) return false;
      }
      return true;
    });
  }, [bugs, statusFilter, priorityFilter, assigneeFilter, myBugsOnly, user?.profile_id]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(selectedIds.size === filteredBugs.length ? new Set() : new Set(filteredBugs.map((b) => b.id)));
  }, [filteredBugs, selectedIds.size]);

  const statusCounts = useMemo(() => {
    if (!bugs) return {};
    const counts: Record<string, number> = {};
    for (const bug of bugs) { const s = bug.status ?? "reported"; counts[s] = (counts[s] ?? 0) + 1; }
    return counts;
  }, [bugs]);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (!bugs || bugs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Bug className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Bugs Reported</h3>
          <p className="text-sm text-muted-foreground mb-4">Report the first bug for this project.</p>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Report Bug
          </Button>
          <AddBugDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            isLoading={createBug.isPending}
            assigneeOptions={assigneeOptions}
            onSubmit={(data) => { createBug.mutate(data, { onSuccess: () => setAddDialogOpen(false) }); }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {STATUS_CARDS.map((status) => {
          const config = BUG_STATUS_DISPLAY[status];
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
        {(["all", "low", "medium", "high", "critical", "production_bug"] as const).map((priority) => (
          <Button key={priority} variant={priorityFilter === priority ? "default" : "outline"} size="sm" onClick={() => setPriorityFilter(priority)} className="text-xs">
            {priority === "production_bug" ? "Prod Issue" : priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Button>
        ))}
        <Button variant={myBugsOnly ? "default" : "outline"} size="sm" onClick={() => setMyBugsOnly((prev) => !prev)} className="text-xs ml-2">
          <User className="h-3 w-3 mr-1" /> My Bugs
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {Array.from(new Map(members.map((m) => [m.profile_id, m])).values()).map((m) => (
                <SelectItem key={m.profile_id} value={m.profile_id}>{m.profile?.full_name ?? m.profile?.email ?? "Unknown"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filteredBugs.length} bug{filteredBugs.length !== 1 ? "s" : ""}</span>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Report Bug</Button>
        </div>
      </div>

      <BulkActionsToolbar
        taskCount={filteredBugs.length}
        selectedIds={selectedIds}
        onToggleAll={toggleSelectAll}
        onClearSelection={() => setSelectedIds(new Set())}
        productId={productId}
      />

      <div className="space-y-2">
        {filteredBugs.map((bug) => (
          <TaskRow
            key={bug.id}
            task={bug}
            selected={selectedIds.has(bug.id)}
            assigneeName={bug.assignee_id ? assigneeMap.get(bug.assignee_id) : undefined}
            onToggle={() => toggleSelect(bug.id)}
            onClick={() => { setEditBug(toKanbanTask(bug, assigneeMap)); setEditDialogOpen(true); }}
            statusDisplay={BUG_STATUS_DISPLAY}
            onStatusChange={(bugId, status) => updateBug.mutate({ id: bugId, status })}
          />
        ))}
      </div>

      <TaskDetailDrawer
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={editBug}
        productId={productId}
        taskType="bug"
        updateMutation={updateBug}
        deleteMutation={deleteBug}
      />
      <AddBugDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        isLoading={createBug.isPending}
        assigneeOptions={assigneeOptions}
        onSubmit={(data) => { createBug.mutate(data, { onSuccess: () => setAddDialogOpen(false) }); }}
      />
    </div>
  );
}

export { BugsTab };
export type { BugsTabProps };
