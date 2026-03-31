"use client";

import { useEffect, useMemo } from "react";
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
import { useProducts } from "@/hooks/queries/useProducts";
import { useAllProductMembers, useProductMembers } from "@/hooks/queries/useProductMembers";
import { useCreateTask } from "@/hooks/mutations/useTaskMutations";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import type { TaskStatus, PillarType, TaskPriority } from "@/lib/types";

const TODAY = () => new Date().toISOString().split("T")[0];

const taskSchema = z.object({
  product_id: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  pillar: z.enum(["business", "marketing", "development", "product"]),
  priority: z.enum(["low", "medium", "high", "critical", "production_bug"]),
  due_date: z.string().optional(),
  created_at: z.string().optional(),
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

interface GlobalAddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalAddTaskDialog({ open, onOpenChange }: GlobalAddTaskDialogProps) {
  const { data: products = [] } = useProducts();
  const { data: allMembers = [] } = useAllProductMembers();
  const { user } = useAuth();
  const { isAdmin, isProjectManager, isEngineer } = useRoleVisibility();
  const canAssignOthers = isAdmin || isProjectManager || isEngineer;

  // AI Engineers (app role "engineer") only see their assigned projects
  const isAIEngineer = isEngineer && !isAdmin && !isProjectManager;

  const projectOptions = useMemo(() => {
    const active = products.filter((p) => !p.archived_at);
    if (isAIEngineer && user?.profile_id) {
      const myProductIds = new Set(
        allMembers
          .filter((m) => m.profile_id === user.profile_id)
          .map((m) => m.product_id),
      );
      return active
        .filter((p) => myProductIds.has(p.id))
        .map((p) => ({ value: p.id, label: p.name }));
    }
    return active.map((p) => ({ value: p.id, label: p.name }));
  }, [products, allMembers, isAIEngineer, user?.profile_id]);

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
      product_id: "",
      title: "",
      description: "",
      pillar: "development",
      priority: "medium",
      due_date: "",
      created_at: "",
      assignee_id: "",
    },
  });

  const selectedProductId = watch("product_id");
  const currentPillar = watch("pillar");
  const currentPriority = watch("priority");
  const currentAssignee = watch("assignee_id");

  const { data: members = [] } = useProductMembers(selectedProductId || "");
  const createTask = useCreateTask(selectedProductId);

  const assigneeOptions = useMemo(() => {
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
  }, [members]);

  // Reset assignee when project changes
  useEffect(() => {
    setValue("assignee_id", "");
  }, [selectedProductId, setValue]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onFormSubmit = (values: TaskFormValues) => {
    const { product_id, ...rest } = values;
    createTask.mutate(
      {
        ...rest,
        status: "backlog" as TaskStatus,
        assignee_id: !rest.assignee_id || rest.assignee_id === "__none__" ? undefined : rest.assignee_id,
        due_date: rest.due_date || TODAY(),
        created_at: rest.created_at ? new Date(rest.created_at).toISOString() : new Date().toISOString(),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-4">
          {/* Project */}
          <div className="space-y-2">
            <SelectField
              label="Project"
              placeholder="Select project"
              options={projectOptions}
              value={selectedProductId}
              onValueChange={(v) => setValue("product_id", v)}
            />
            {errors.product_id && (
              <p className="text-sm text-destructive">{errors.product_id.message}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <BaseLabel htmlFor="global-task-title">Title</BaseLabel>
            <BaseInput
              id="global-task-title"
              placeholder="Task title..."
              {...register("title")}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <BaseLabel htmlFor="global-task-desc">Description</BaseLabel>
            <BaseTextarea
              id="global-task-desc"
              placeholder="Optional description..."
              className="resize-none"
              {...register("description")}
            />
          </div>

          {/* Assignee */}
          {selectedProductId ? (
            canAssignOthers ? (
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
            )
          ) : (
            <div className="space-y-2">
              <BaseLabel>Assignee</BaseLabel>
              <p className="text-sm text-muted-foreground rounded-md border px-3 py-2">
                Select a project first
              </p>
            </div>
          )}

          {/* Vertical + Priority row */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Due date + Created date row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <BaseLabel htmlFor="global-task-due">Due Date</BaseLabel>
              <BaseInput
                id="global-task-due"
                type="date"
                min={TODAY()}
                {...register("due_date")}
              />
              <p className="text-xs text-muted-foreground">Defaults to today</p>
            </div>
            <div className="space-y-2">
              <BaseLabel htmlFor="global-task-created">Created Date</BaseLabel>
              <BaseInput
                id="global-task-created"
                type="date"
                {...register("created_at")}
              />
              <p className="text-xs text-muted-foreground">Defaults to today</p>
            </div>
          </div>

          {/* Actions */}
          <DialogFooter className="pt-2">
            <BaseButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={createTask.isPending || !selectedProductId}>
              {createTask.isPending ? "Creating..." : "Create Task"}
            </BaseButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
