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
import { SearchableSelect } from "@/components/molecules/forms/SearchableSelect";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
});

export type MarketingTaskFormValues = z.infer<typeof schema>;

interface AssigneeOption { value: string; label: string }

interface ChecklistOption { value: string; label: string }

interface AddMarketingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MarketingTaskFormValues) => void;
  isLoading?: boolean;
  assigneeOptions?: AssigneeOption[];
  isSubtask?: boolean;
  prefillTitle?: string;
  checklistOptions?: ChecklistOption[];
}

export function AddMarketingTaskDialog({
  open, onOpenChange, onSubmit, isLoading, assigneeOptions = [], isSubtask = false, prefillTitle, checklistOptions = [],
}: AddMarketingTaskDialogProps) {
  const [linkedChecklist, setLinkedChecklist] = useState("");
  const defaults: MarketingTaskFormValues = { title: "", description: "", assignee_id: "", due_date: "" };

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<MarketingTaskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset({ ...defaults, title: prefillTitle || "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset, prefillTitle]);

  const currentAssignee = watch("assignee_id");

  const handleFormSubmit = (values: MarketingTaskFormValues) => {
    onSubmit({
      ...values,
      assignee_id: values.assignee_id || undefined,
      due_date: values.due_date || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isSubtask ? "Add Subtask" : "Add Marketing Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4 min-w-0 overflow-hidden">
          <div className="space-y-2">
            <BaseLabel htmlFor="mkt-title">Title</BaseLabel>
            <BaseInput id="mkt-title" placeholder="Task title..." {...register("title")} aria-invalid={!!errors.title} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <BaseLabel htmlFor="mkt-desc">Description</BaseLabel>
            <BaseTextarea id="mkt-desc" placeholder="Task details..." className="resize-y w-full box-border" rows={6} {...register("description")} aria-invalid={!!errors.description} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          {checklistOptions.length > 0 && (
            <SearchableSelect
              label="Linked GTM Checklist Item"
              placeholder="Select checklist item..."
              options={checklistOptions}
              value={linkedChecklist}
              onValueChange={(v) => {
                setLinkedChecklist(v);
                if (v) {
                  const item = checklistOptions.find((o) => o.value === v);
                  if (item && !watch("title")) {
                    const titleOnly = item.label.replace(/\s*\([^)]*\)\s*$/, "");
                    setValue("title", titleOnly);
                  }
                }
              }}
              allowClear
              clearLabel="No linked item"
            />
          )}

          <SearchableSelect
            label="Assigned To"
            placeholder="Select assignee"
            options={assigneeOptions}
            value={currentAssignee || ""}
            onValueChange={(v) => setValue("assignee_id", v)}
            allowClear
            clearLabel="Unassigned"
          />

          <div className="space-y-2">
            <BaseLabel htmlFor="mkt-due">Due Date</BaseLabel>
            <BaseInput id="mkt-due" type="date" {...register("due_date")} />
          </div>

          <DialogFooter className="pt-2">
            <BaseButton type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</BaseButton>
            <BaseButton type="submit" disabled={isLoading}>{isLoading ? "Creating..." : isSubtask ? "Add Subtask" : "Add Task"}</BaseButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
