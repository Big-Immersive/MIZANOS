"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { PageHeader } from "@/components/molecules/layout/PageHeader";
import { TasksFilterBar } from "@/components/organisms/tasks/TasksFilterBar";
import { TaskDetailDrawer } from "@/components/organisms/product/TaskDetailDrawer";
import { toKanbanTask } from "@/components/organisms/kanban/kanban-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAllTasks } from "@/hooks/queries/useAllTasks";
import { useProducts } from "@/hooks/queries/useProducts";
import { useAllProductMembers } from "@/hooks/queries/useProductMembers";
import { useProfiles } from "@/hooks/queries/useProfiles";
import { TASK_STATUS_DISPLAY, TASK_PRIORITY_COLORS, TASK_STATUSES } from "@/lib/constants";
import { isMyDashboardEnabled } from "@/hooks/utils/useMyDashboard";
import type { Task, KanbanTask } from "@/lib/types";
import { ClipboardCheck, ListTodo, Loader2 } from "lucide-react";

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <TasksPageContent />
    </Suspense>
  );
}

function TasksPageContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(
    searchParams.get("project") || "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [editTask, setEditTask] = useState<KanbanTask | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { user } = useAuth();

  const myDashboardApplied = useRef(false);
  useEffect(() => {
    if (myDashboardApplied.current) return;
    if (user?.profile_id && isMyDashboardEnabled()) {
      myDashboardApplied.current = true;
      setAssigneeFilter(user.profile_id);
    }
  }, [user?.profile_id]);

  const filters = {
    product_id: projectFilter !== "all" ? projectFilter : undefined,
    assignee_id: assigneeFilter !== "all" ? assigneeFilter : undefined,
    pm_id: pmFilter !== "all" ? pmFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    pillar: pillarFilter !== "all" ? pillarFilter : undefined,
    search: search || undefined,
  };

  const { data: tasks, isLoading } = useAllTasks(filters);
  const { data: products = [] } = useProducts();
  const { data: allMembers = [] } = useAllProductMembers();
  const { data: profiles = [] } = useProfiles();

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.id, p.name);
    return map;
  }, [products]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.id, p.full_name ?? p.email ?? "Unknown");
    return map;
  }, [profiles]);

  const pmProfiles = useMemo(() => {
    const pmMemberIds = new Set(
      allMembers.filter((m) => m.role === "project_manager").map((m) => m.profile_id),
    );
    return profiles.filter(
      (p) => pmMemberIds.has(p.id) || p.role === "project_manager",
    );
  }, [allMembers, profiles]);

  const statusCounts = useMemo(() => {
    if (!tasks) return {};
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const s = task.status ?? "backlog";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const hasActiveFilters =
    search !== "" ||
    projectFilter !== "all" ||
    assigneeFilter !== "all" ||
    pmFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    pillarFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setProjectFilter("all");
    setAssigneeFilter("all");
    setPmFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setPillarFilter("all");
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="All tasks across your projects"
        icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
      />

      <div className="flex gap-2">
        {TASK_STATUSES.map((status) => {
          const config = TASK_STATUS_DISPLAY[status];
          const Icon = config.icon;
          const count = statusCounts[status] ?? 0;
          const active = statusFilter === status;
          return (
            <Card
              key={status}
              className={`flex-1 cursor-pointer hover:bg-accent/50 transition-colors ${active ? "border-primary/40" : ""}`}
              onClick={() => setStatusFilter(active ? "all" : status)}
            >
              <CardContent className="px-3 py-2 flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${active ? config.color : "text-muted-foreground"}`} />
                <span className="text-sm font-semibold tabular-nums">{count}</span>
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TasksFilterBar
        search={search}
        onSearchChange={setSearch}
        projectFilter={projectFilter}
        onProjectChange={setProjectFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
        pmFilter={pmFilter}
        onPmChange={setPmFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        pillarFilter={pillarFilter}
        onPillarChange={setPillarFilter}
        projects={products.filter((p) => !p.archived_at)}
        profiles={profiles}
        pmProfiles={pmProfiles}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {isLoading && <TasksSkeleton />}

      {!isLoading && tasks && tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projectName={productMap.get(task.product_id)}
              assigneeName={task.assignee_id ? profileMap.get(task.assignee_id) : undefined}
              onClick={() => {
                setEditTask(toKanbanTask(task, profileMap));
                setEditDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {!isLoading && (!tasks || tasks.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
            <ListTodo className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">No tasks found</h3>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "Try adjusting your filters" : "Tasks will appear here once created in your projects"}
          </p>
        </div>
      )}

      <TaskDetailDrawer
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={editTask}
        productId={editTask?.productId ?? ""}
      />
    </div>
  );
}

function TaskRow({
  task,
  projectName,
  assigneeName,
  onClick,
}: {
  task: Task;
  projectName?: string;
  assigneeName?: string;
  onClick: () => void;
}) {
  const config = TASK_STATUS_DISPLAY[task.status ?? "backlog"] ?? TASK_STATUS_DISPLAY.backlog;
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
      </div>

      {projectName && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] shrink-0">{projectName}</span>
      )}

      {assigneeName && (
        <span className="text-xs text-muted-foreground truncate max-w-[100px] shrink-0">{assigneeName}</span>
      )}

      {task.priority && (
        <Badge variant="secondary" className={`text-[10px] shrink-0 capitalize ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}>
          {task.priority}
        </Badge>
      )}

      {task.due_date && (
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {new Date(task.due_date).toLocaleDateString()}
        </span>
      )}

      <Badge variant="outline" className="shrink-0 text-xs">
        {config.label}
      </Badge>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}
