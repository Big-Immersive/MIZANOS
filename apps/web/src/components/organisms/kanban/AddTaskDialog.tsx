"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/atoms/layout/Dialog";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { BaseTextarea } from "@/components/atoms/inputs/BaseTextarea";
import { BaseLabel } from "@/components/atoms/inputs/BaseLabel";
import { SelectField } from "@/components/molecules/forms/SelectField";
import { useProductMembers } from "@/hooks/queries/useProductMembers";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import type { TaskStatus, PillarType, TaskPriority } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  pillar: z.enum(["business", "marketing", "development", "product"]),
  priority: z.enum(["low", "medium", "high", "critical", "production_bug"]),
  status: z.enum(["backlog", "in_progress", "review", "done", "live", "cancelled"]),
  due_date: z.string().optional(),
  created_at: z.string().optional(),
  assignee_id: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

/* ------------------------------------------------------------------ */
/*  Options                                                            */
/* ------------------------------------------------------------------ */

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
];

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "live", label: "Live" },
  { value: "cancelled", label: "Cancelled" },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormValues & { status: TaskStatus }) => void;
  defaultStatus: TaskStatus;
  isLoading?: boolean;
  productId: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AddTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultStatus,
  isLoading,
  productId,
}: AddTaskDialogProps) {
  const { data: members = [] } = useProductMembers(productId);
  const { user } = useAuth();
  const { isAdmin, isProjectManager, isEngineer } = useRoleVisibility();
  const canAssignOthers = isAdmin || isProjectManager || isEngineer;

  const assigneeOptions = (() => {
    const seen = new Map<string, string>();
    for (const m of members) {
      const name = m.profile?.full_name ?? m.profile?.email ?? "Unnamed";
      const existing = seen.get(m.profile_id);
      seen.set(m.profile_id, existing ? `${name} — ${existing.split(" — ").pop()}, ${m.role}` : `${name}${m.role ? ` — ${m.role}` : ""}`);
    }
    return [
      { value: "__none__", label: "Unassigned" },
      ...Array.from(seen.entries()).map(([id, label]) => ({ value: id, label })),
    ];
  })();

  const defaultValues: TaskFormValues = {
    title: "",
    description: "",
    pillar: "development",
    priority: "medium",
    status: defaultStatus,
    due_date: "",
    created_at: "",
    assignee_id: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues,
  });

  /* Reset when dialog closes */
  useEffect(() => {
    if (!open) {
      reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const onFormSubmit = (values: TaskFormValues) => {
    onSubmit({
      ...values,
      status: values.status || defaultStatus,
      assignee_id:
        !values.assignee_id || values.assignee_id === "__none__" ? undefined : values.assignee_id,
      due_date: values.due_date || new Date().toISOString().split("T")[0],
      created_at: values.created_at ? new Date(values.created_at).toISOString() : new Date().toISOString(),
    });
  };

  const currentPillar = watch("pillar");
  const currentPriority = watch("priority");
  const currentStatus = watch("status");
  const currentAssignee = watch("assignee_id");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="flex flex-col gap-4"
        >
          {/* Title */}
          <div className="space-y-2">
            <BaseLabel htmlFor="task-title">Title</BaseLabel>
            <BaseInput
              id="task-title"
              placeholder="Task title..."
              {...register("title")}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p className="text-sm text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <BaseLabel htmlFor="task-description">Description</BaseLabel>
            <BaseTextarea
              id="task-description"
              placeholder="Optional description..."
              className="resize-none"
              {...register("description")}
            />
          </div>

          {/* Assignee */}
          {canAssignOthers ? (
            <SelectField
              label="Assignee"
              placeholder="Select assignee"
              options={assigneeOptions}
              value={currentAssignee || "__none__"}
              onValueChange={(v) => setValue("assignee_id", v)}
            />
          ) : (
            <div className="space-y-2">
              <BaseLabel>Assignee</BaseLabel>
              <p className="text-sm text-muted-foreground rounded-md border px-3 py-2">
                Assigned to you ({user?.full_name ?? user?.email})
              </p>
            </div>
          )}

          {/* Vertical + Priority + Status row */}
          <div className="grid grid-cols-3 gap-4">
            <SelectField
              label="Business Vertical"
              placeholder="Select vertical"
              options={PILLAR_OPTIONS}
              value={currentPillar}
              onValueChange={(v) =>
                setValue("pillar", v as PillarType)
              }
            />
            <SelectField
              label="Priority"
              placeholder="Select priority"
              options={PRIORITY_OPTIONS}
              value={currentPriority}
              onValueChange={(v) =>
                setValue("priority", v as TaskPriority)
              }
            />
            <SelectField
              label="Status"
              placeholder="Select status"
              options={STATUS_OPTIONS}
              value={currentStatus}
              onValueChange={(v) =>
                setValue("status", v as TaskStatus)
              }
            />
          </div>

          {/* Due date + Created date row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <BaseLabel htmlFor="task-due-date">Due Date</BaseLabel>
              <BaseInput
                id="task-due-date"
                type="date"
                {...register("due_date")}
              />
            </div>
            <div className="space-y-2">
              <BaseLabel htmlFor="task-created-date">Created Date</BaseLabel>
              <BaseInput
                id="task-created-date"
                type="date"
                {...register("created_at")}
              />
              <p className="text-xs text-muted-foreground">Defaults to today</p>
            </div>
          </div>

          {/* Actions */}
          <DialogFooter className="pt-2">
            <BaseButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Task"}
            </BaseButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
