"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/atoms/layout/Sheet";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { BaseTextarea } from "@/components/atoms/inputs/BaseTextarea";
import { BaseLabel } from "@/components/atoms/inputs/BaseLabel";
import { SelectField } from "@/components/molecules/forms/SelectField";
import { DeleteTaskDialog } from "@/components/molecules/feedback/DeleteTaskDialog";
import { BugAttachments } from "@/components/molecules/tasks/BugAttachments";
import { CommentThread } from "@/components/molecules/comments/CommentThread";
import { TaskChecklist } from "@/components/molecules/tasks/TaskChecklist";
import { useProductMembers } from "@/hooks/queries/useProductMembers";
import { useMilestones } from "@/hooks/queries/useMilestones";
import { useUpdateTask, useDeleteTask } from "@/hooks/mutations/useTaskMutations";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import type { KanbanTask, PillarType, TaskPriority, ProductMember } from "@/lib/types";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  pillar: z.enum(["business", "marketing", "development", "product"]),
  priority: z.enum(["low", "medium", "high", "critical", "production_bug"]),
  status: z.string(),
  due_date: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  assignee_id: z.string().optional(),
  milestone_id: z.string().optional(),
});
type TaskFormValues = z.infer<typeof taskSchema>;

const PILLAR_OPTIONS = [
  { value: "business", label: "Business" },
  { value: "marketing", label: "Marketing" },
  { value: "development", label: "Development" },
  { value: "product", label: "Product" },
];
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
  { value: "production_bug", label: "Prod Issue" },
];
const TASK_STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "live", label: "Live" },
  { value: "cancelled", label: "Cancelled" },
];
const MARKETING_TASK_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_execution", label: "In Execution" },
  { value: "completed", label: "Completed" },
];
const BUG_STATUS_OPTIONS = [
  { value: "reported", label: "Reported" },
  { value: "triaging", label: "Triaging" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
  { value: "verified", label: "Verified" },
  { value: "reopened", label: "Reopened" },
  { value: "wont_fix", label: "Won't Fix" },
  { value: "live", label: "Live" },
];

interface TaskDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: KanbanTask | null;
  productId: string;
  taskType?: "task" | "bug" | "marketing_task";
  updateMutation?: ReturnType<typeof useUpdateTask>;
  deleteMutation?: ReturnType<typeof useDeleteTask>;
}

export function TaskDetailDrawer({
  open,
  onOpenChange,
  task,
  productId,
  taskType = "task",
  updateMutation,
  deleteMutation,
}: TaskDetailDrawerProps) {
  const { data: members = [] } = useProductMembers(productId);
  const { data: milestones = [] } = useMilestones(productId);
  const defaultUpdate = useUpdateTask(productId);
  const defaultDelete = useDeleteTask(productId);
  const updateTask = updateMutation ?? defaultUpdate;
  const deleteTask = deleteMutation ?? defaultDelete;
  const isBug = taskType === "bug";
  const isMarketing = taskType === "marketing_task";
  const statusOptions = isBug ? BUG_STATUS_OPTIONS : isMarketing ? MARKETING_TASK_STATUS_OPTIONS : TASK_STATUS_OPTIONS;
  const { user } = useAuth();
  const { isAdmin, isProjectManager, isEngineer } = useRoleVisibility();
  const canManageTasks = isAdmin || isProjectManager || isEngineer;
  const isAIEngineerOnly = isEngineer && !isAdmin && !isProjectManager;
  const isCreator = !!task?.createdBy && task.createdBy === user?.profile_id;
  const canEditDetails = canManageTasks || isCreator;
  const canDeleteTask = canEditDetails;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const milestoneOptions = useMemo(() =>
    milestones.map((m) => ({ value: m.id, label: m.title })),
  [milestones]);

  const assigneeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of [...members].sort((a, b) => (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? ""))) {
      const name = m.profile?.full_name ?? m.profile?.email ?? "Unnamed";
      const existing = seen.get(m.profile_id);
      seen.set(m.profile_id, existing ? `${name} — ${existing.split(" — ").pop()}, ${m.role}` : `${name}${m.role ? ` — ${m.role}` : ""}`);
    }
    return [
      { value: "__none__", label: "Unassigned" },
      ...Array.from(seen.entries()).map(([id, label]) => ({ value: id, label })),
    ];
  }, [members]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "", description: "", pillar: "development",
      priority: "medium", status: "backlog", due_date: "", start_date: "", end_date: "", assignee_id: "", milestone_id: "",
    },
  });

  useEffect(() => {
    if (task && open) {
      reset({
        title: task.title,
        description: task.description ?? "",
        pillar: task.pillar,
        priority: task.priority,
        status: task.status,
        due_date: task.dueDate?.slice(0, 10) ?? "",
        start_date: task.startDate?.slice(0, 10) ?? "",
        end_date: task.endDate?.slice(0, 10) ?? "",
        assignee_id: task.assigneeId ?? "__none__",
        milestone_id: task.milestoneId ?? "",
      });
    }
  }, [task, open, reset]);

  const onFormSubmit = (values: TaskFormValues) => {
    if (!task) return;
    const base = { id: task.id, status: values.status };
    const details = { title: values.title, description: values.description ?? null, pillar: values.pillar, priority: values.priority, due_date: values.due_date || null, start_date: values.start_date || null, end_date: values.end_date || null, milestone_id: values.milestone_id || null };
    const payload = canManageTasks
      ? { ...base, ...details, assignee_id: values.assignee_id === "__none__" ? null : (values.assignee_id ?? null) }
      : isCreator ? { ...base, ...details } : base;
    updateTask.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  const currentPillar = watch("pillar");
  const currentPriority = watch("priority");
  const currentStatus = watch("status");
  const currentAssignee = watch("assignee_id");
  const currentMilestone = watch("milestone_id");
  const isUnassigned = !currentAssignee || currentAssignee === "__none__";
  const [assignWarning, setAssignWarning] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[600px] w-full flex flex-col p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{isBug ? "Bug Details" : "Task Details"}</SheetTitle>
          <SheetDescription className="sr-only">Edit {isBug ? "bug" : "task"} details and view comments</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          <form id="task-detail-form" onSubmit={(e) => { e.preventDefault(); const submitter = (e.nativeEvent as SubmitEvent).submitter; if (submitter?.getAttribute("data-save") === "true") handleSubmit(onFormSubmit)(e); }} className="space-y-3">
            <div className="space-y-1">
              <BaseLabel htmlFor="drawer-title">Title</BaseLabel>
              <BaseInput id="drawer-title" {...register("title")} aria-invalid={!!errors.title} disabled={!canEditDetails} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-1">
              <BaseLabel htmlFor="drawer-desc">Description</BaseLabel>
              <BaseTextarea id="drawer-desc" className="resize-y" rows={7} {...register("description")} disabled={!canEditDetails} />
            </div>

            {isBug && task && (
              <div className="border-t pt-3">
                <BugAttachments taskId={task.id} />
              </div>
            )}

            {task && (
              <div
                className="border-t pt-3"
                onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); e.stopPropagation(); } }}
              >
                <TaskChecklist taskId={task.id} />
              </div>
            )}

            {canManageTasks && (
              <SelectField
                label="Assignee"
                placeholder="Select assignee"
                options={assigneeOptions}
                value={currentAssignee || "__none__"}
                onValueChange={(v) => {
                  setValue("assignee_id", v);
                  if ((!v || v === "__none__") && currentStatus !== "backlog" && currentStatus !== "cancelled") {
                    setValue("status", "backlog");
                    setAssignWarning(true);
                    setTimeout(() => setAssignWarning(false), 3000);
                  }
                }}
              />
            )}

            {milestoneOptions.length > 0 && canEditDetails && !isBug && (
              <SelectField
                label="Milestone"
                placeholder="Select milestone"
                options={milestoneOptions}
                value={currentMilestone || ""}
                onValueChange={(v) => setValue("milestone_id", v)}
              />
            )}

            <div className={canEditDetails ? `grid ${isMarketing ? "grid-cols-2" : "grid-cols-3"} gap-3` : ""}>
              {canEditDetails && (
                <>
                  {!isMarketing && <SelectField label="Vertical" placeholder="Vertical" options={PILLAR_OPTIONS} value={currentPillar} onValueChange={(v) => setValue("pillar", v as PillarType)} />}
                  <SelectField label="Priority" placeholder="Priority" options={PRIORITY_OPTIONS} value={currentPriority} onValueChange={(v) => setValue("priority", v as TaskPriority)} />
                </>
              )}
              <SelectField
                label="Status"
                placeholder="Status"
                options={statusOptions}
                value={currentStatus}
                onValueChange={(v) => {
                  if (isUnassigned && v !== "backlog" && v !== "cancelled") {
                    setAssignWarning(true);
                    setTimeout(() => setAssignWarning(false), 3000);
                    return;
                  }
                  setValue("status", v);
                }}
              />
            </div>

            {assignWarning && (
              <p className="animate-in fade-in rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                Please assign this task before changing its status
              </p>
            )}

            {canEditDetails && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <BaseLabel htmlFor="drawer-due">Due Date</BaseLabel>
                    <BaseInput id="drawer-due" type="date" min={new Date().toISOString().split("T")[0]} {...register("due_date")} disabled={isAIEngineerOnly} />
                  </div>
                  <div className="space-y-1">
                    <BaseLabel>Created Date</BaseLabel>
                    <p className="text-sm text-muted-foreground rounded-md border px-3 py-2">
                      {task?.createdAt ? new Date(task.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <BaseLabel htmlFor="drawer-start">Start Date</BaseLabel>
                    <BaseInput id="drawer-start" type="date" {...register("start_date")} />
                  </div>
                  <div className="space-y-1">
                    <BaseLabel htmlFor="drawer-end">End Date</BaseLabel>
                    <BaseInput id="drawer-end" type="date" {...register("end_date")} />
                  </div>
                </div>

                {watch("start_date") && watch("end_date") && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Time taken: <span className="font-medium text-foreground">
                        {Math.max(0, Math.ceil((new Date(watch("end_date")!).getTime() - new Date(watch("start_date")!).getTime()) / (1000 * 60 * 60 * 24)))} days
                      </span>
                      {watch("due_date") && new Date(watch("end_date")!) <= new Date(watch("due_date")!) && (
                        <span className="text-emerald-500 ml-1">
                          ({Math.ceil((new Date(watch("due_date")!).getTime() - new Date(watch("end_date")!).getTime()) / (1000 * 60 * 60 * 24))} days before deadline)
                        </span>
                      )}
                      {watch("due_date") && new Date(watch("end_date")!) > new Date(watch("due_date")!) && (
                        <span className="text-destructive ml-1">
                          ({Math.ceil((new Date(watch("end_date")!).getTime() - new Date(watch("due_date")!).getTime()) / (1000 * 60 * 60 * 24))} days overdue)
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-2 pt-1">
              {canDeleteTask && (
                <BaseButton
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </BaseButton>
              )}
              <div className="flex-1" />
              <BaseButton type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</BaseButton>
              <BaseButton type="submit" data-save="true" disabled={updateTask.isPending}>
                {updateTask.isPending ? "Saving..." : "Save"}
              </BaseButton>
            </div>
          </form>

          {task?.createdAt && (
            <TaskMetaInfo task={task} members={members} />
          )}

          <div className="border-t pt-4">
            {task && <CommentThread taskId={task.id} productId={productId} />}
          </div>
        </div>

        {task && (
          <DeleteTaskDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            taskTitle={task.title}
            taskStatus={task.status}
            subtaskCount={task.subtaskCount}
            isPending={deleteTask.isPending}
            onConfirm={() => {
              deleteTask.mutate(task.id, {
                onSuccess: () => {
                  setDeleteDialogOpen(false);
                  onOpenChange(false);
                },
              });
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskMetaInfo({ task, members }: { task: KanbanTask; members: ProductMember[] }) {
  const creator = task.createdBy ? members.find((m) => m.profile_id === task.createdBy) : null;
  const name = creator?.profile?.full_name ?? creator?.profile?.email ?? null;
  const date = new Date(task.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-3">
      {name && <span>Created by <span className="font-medium text-foreground">{name}</span></span>}
      <span>on {date}</span>
    </div>
  );
}
