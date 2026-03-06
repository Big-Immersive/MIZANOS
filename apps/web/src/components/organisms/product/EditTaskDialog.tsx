"use client";

import { useEffect, useState } from "react";
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
import { useUpdateTask } from "@/hooks/mutations/useTaskMutations";
import type { KanbanTask, TaskStatus, PillarType, TaskPriority } from "@/lib/types";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  pillar: z.enum(["business", "marketing", "development", "product"]),
  priority: z.enum(["low", "medium", "high", "critical", "production_bug"]),
  status: z.enum(["backlog", "in_progress", "review", "done", "live", "cancelled"]),
  due_date: z.string().optional(),
  assignee_id: z.string().optional(),
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
];

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "live", label: "Live" },
  { value: "cancelled", label: "Cancelled" },
];

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: KanbanTask | null;
  productId: string;
}

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  productId,
}: EditTaskDialogProps) {
  const { data: members = [] } = useProductMembers(productId);
  const updateTask = useUpdateTask(productId);

  const assigneeOptions = [
    { value: "__none__", label: "Unassigned" },
    ...members.map((m) => ({
      value: m.profile_id,
      label: `${m.profile?.full_name ?? m.profile?.email ?? "Unnamed"}${m.role ? ` — ${m.role}` : ""}`,
    })),
  ];

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
      title: "",
      description: "",
      pillar: "development",
      priority: "medium",
      status: "backlog",
      due_date: "",
      assignee_id: "",
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
        assignee_id: task.assigneeId ?? "__none__",
      });
    }
  }, [task, open, reset]);

  const onFormSubmit = (values: TaskFormValues) => {
    if (!task) return;
    updateTask.mutate(
      {
        id: task.id,
        title: values.title,
        description: values.description ?? null,
        pillar: values.pillar,
        priority: values.priority,
        status: values.status,
        due_date: values.due_date || null,
        assignee_id:
          values.assignee_id === "__none__" ? null : (values.assignee_id ?? null),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const currentPillar = watch("pillar");
  const currentPriority = watch("priority");
  const currentStatus = watch("status");
  const currentAssignee = watch("assignee_id");

  const isUnassigned = !currentAssignee || currentAssignee === "__none__";
  const [assignWarning, setAssignWarning] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="space-y-2">
            <BaseLabel htmlFor="edit-task-title">Title</BaseLabel>
            <BaseInput
              id="edit-task-title"
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

          <div className="space-y-2">
            <BaseLabel htmlFor="edit-task-description">Description</BaseLabel>
            <BaseTextarea
              id="edit-task-description"
              placeholder="Optional description..."
              className="resize-none"
              {...register("description")}
            />
          </div>

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

          <div className="grid grid-cols-3 gap-4">
            <SelectField
              label="Business Vertical"
              placeholder="Select vertical"
              options={PILLAR_OPTIONS}
              value={currentPillar}
              onValueChange={(v) => setValue("pillar", v as PillarType)}
            />
            <SelectField
              label="Priority"
              placeholder="Select priority"
              options={PRIORITY_OPTIONS}
              value={currentPriority}
              onValueChange={(v) => setValue("priority", v as TaskPriority)}
            />
            <SelectField
              label="Status"
              placeholder="Select status"
              options={STATUS_OPTIONS}
              value={currentStatus}
              onValueChange={(v) => {
                if (isUnassigned && v !== "backlog" && v !== "cancelled") {
                  setAssignWarning(true);
                  setTimeout(() => setAssignWarning(false), 3000);
                  return;
                }
                setValue("status", v as TaskStatus);
              }}
            />
          </div>

          {assignWarning && (
            <p className="animate-in fade-in rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Please assign this task before changing its status
            </p>
          )}

          <div className="space-y-2">
            <BaseLabel htmlFor="edit-task-due-date">Due Date</BaseLabel>
            <BaseInput
              id="edit-task-due-date"
              type="date"
              {...register("due_date")}
            />
          </div>

          <DialogFooter className="pt-2">
            <BaseButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={updateTask.isPending}>
              {updateTask.isPending ? "Saving..." : "Save Changes"}
            </BaseButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
