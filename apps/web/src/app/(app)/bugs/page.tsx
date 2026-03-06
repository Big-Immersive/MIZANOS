"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { PageHeader } from "@/components/molecules/layout/PageHeader";
import { TasksFilterBar } from "@/components/organisms/tasks/TasksFilterBar";
import { TaskDetailDrawer } from "@/components/organisms/product/TaskDetailDrawer";
import { AddBugDialog } from "@/components/organisms/kanban/AddBugDialog";
import { toKanbanTask } from "@/components/organisms/kanban/kanban-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAllBugs } from "@/hooks/queries/useAllBugs";
import { useProducts } from "@/hooks/queries/useProducts";
import { useAllProductMembers } from "@/hooks/queries/useProductMembers";
import { useProfiles } from "@/hooks/queries/useProfiles";
import { useCreateBug } from "@/hooks/mutations/useBugMutations";
import { useProductMembers } from "@/hooks/queries/useProductMembers";
import { BUG_STATUS_DISPLAY, BUG_STATUSES, TASK_PRIORITY_COLORS } from "@/lib/constants";
import type { Task, KanbanTask } from "@/lib/types";
import { Bug as BugIcon, ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/molecules/buttons/Button";
import { SelectField } from "@/components/molecules/forms/SelectField";

export default function BugsPage() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [editBug, setEditBug] = useState<KanbanTask | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addProductId, setAddProductId] = useState("");

  const { user } = useAuth();

  const filters = {
    product_id: projectFilter !== "all" ? projectFilter : undefined,
    assignee_id: assigneeFilter !== "all" ? assigneeFilter : undefined,
    pm_id: pmFilter !== "all" ? pmFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    search: search || undefined,
  };

  const { data: bugs, isLoading } = useAllBugs(filters);
  const { data: products = [] } = useProducts();
  const { data: allMembers = [] } = useAllProductMembers();
  const { data: profiles = [] } = useProfiles();
  const createBug = useCreateBug(addProductId);
  const { data: selectedProductMembers = [] } = useProductMembers(addProductId || "__skip__");
  const selectedAssigneeOptions = useMemo(() =>
    selectedProductMembers.map((m) => ({
      value: m.profile_id,
      label: `${m.profile?.full_name ?? m.profile?.email ?? "Unnamed"}${m.role ? ` — ${m.role}` : ""}`,
    })),
  [selectedProductMembers]);

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
    return profiles.filter((p) => pmMemberIds.has(p.id) || p.role === "project_manager");
  }, [allMembers, profiles]);

  const statusCounts = useMemo(() => {
    if (!bugs) return {};
    const counts: Record<string, number> = {};
    for (const bug of bugs) { const s = bug.status ?? "reported"; counts[s] = (counts[s] ?? 0) + 1; }
    return counts;
  }, [bugs]);

  const hasActiveFilters = search !== "" || projectFilter !== "all" || assigneeFilter !== "all" || pmFilter !== "all" || statusFilter !== "all" || priorityFilter !== "all";

  const clearFilters = () => {
    setSearch(""); setProjectFilter("all"); setAssigneeFilter("all"); setPmFilter("all"); setStatusFilter("all"); setPriorityFilter("all"); setPillarFilter("all");
  };

  const activeProducts = products.filter((p) => !p.archived_at);
  const productOptions = activeProducts.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader title="Bugs" subtitle="All bugs across your projects" icon={<BugIcon className="h-5 w-5 text-primary" />} />
        <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Report Bug</Button>
      </div>

      <div className="flex gap-2">
        {BUG_STATUSES.map((status) => {
          const config = BUG_STATUS_DISPLAY[status];
          const Icon = config.icon;
          const count = statusCounts[status] ?? 0;
          const active = statusFilter === status;
          return (
            <Card key={status} className={`flex-1 cursor-pointer hover:bg-accent/50 transition-colors ${active ? "border-primary/40" : ""}`} onClick={() => setStatusFilter(active ? "all" : status)}>
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
        search={search} onSearchChange={setSearch}
        projectFilter={projectFilter} onProjectChange={setProjectFilter}
        assigneeFilter={assigneeFilter} onAssigneeChange={setAssigneeFilter}
        pmFilter={pmFilter} onPmChange={setPmFilter}
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter} onPriorityChange={setPriorityFilter}
        pillarFilter={pillarFilter} onPillarChange={setPillarFilter}
        projects={activeProducts} profiles={profiles} pmProfiles={pmProfiles}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters}
        statusOptions={BUG_STATUSES} statusDisplayMap={BUG_STATUS_DISPLAY}
        searchPlaceholder="Search bugs..." myItemsLabel="My Bugs" hidePillar
      />

      {isLoading && <BugsSkeleton />}

      {!isLoading && bugs && bugs.length > 0 && (
        <div className="space-y-2">
          {bugs.map((bug) => (
            <BugRow
              key={bug.id}
              bug={bug}
              projectName={productMap.get(bug.product_id)}
              assigneeName={bug.assignee_id ? profileMap.get(bug.assignee_id) : undefined}
              onClick={() => { setEditBug(toKanbanTask(bug, profileMap)); setEditDialogOpen(true); }}
            />
          ))}
        </div>
      )}

      {!isLoading && (!bugs || bugs.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
            <ListTodo className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">No bugs found</h3>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "Try adjusting your filters" : "Bugs will appear here once reported"}
          </p>
        </div>
      )}

      <TaskDetailDrawer open={editDialogOpen} onOpenChange={setEditDialogOpen} task={editBug} productId={editBug?.productId ?? ""} taskType="bug" />

      {addDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Select Project</h3>
            <SelectField label="Project" placeholder="Choose a project" options={productOptions} value={addProductId} onValueChange={setAddProductId} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAddDialogOpen(false); setAddProductId(""); }}>Cancel</Button>
              <Button size="sm" disabled={!addProductId} onClick={() => { setAddDialogOpen(false); }}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {addProductId && !addDialogOpen && (
        <AddBugDialog
          open={true}
          onOpenChange={(open) => { if (!open) setAddProductId(""); }}
          isLoading={createBug.isPending}
          assigneeOptions={selectedAssigneeOptions}
          onSubmit={(data) => { createBug.mutate(data, { onSuccess: () => setAddProductId("") }); }}
        />
      )}
    </div>
  );
}

function BugRow({ bug, projectName, assigneeName, onClick }: { bug: Task; projectName?: string; assigneeName?: string; onClick: () => void }) {
  const config = BUG_STATUS_DISPLAY[bug.status ?? "reported"] ?? BUG_STATUS_DISPLAY.reported;
  const Icon = config.icon;

  return (
    <div onClick={onClick} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
      <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{bug.title}</p>
        {bug.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{bug.description}</p>}
      </div>
      {projectName && <span className="text-xs text-muted-foreground truncate max-w-[120px] shrink-0">{projectName}</span>}
      {assigneeName && <span className="text-xs text-muted-foreground truncate max-w-[100px] shrink-0">{assigneeName}</span>}
      {bug.priority && (
        <Badge variant="secondary" className={`text-[10px] shrink-0 capitalize ${TASK_PRIORITY_COLORS[bug.priority] ?? ""}`}>{bug.priority}</Badge>
      )}
      <Badge variant="outline" className="shrink-0 text-xs">{config.label}</Badge>
    </div>
  );
}

function BugsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  );
}
