"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Paperclip, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
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
import type { TaskPriority } from "@/lib/types";

const ACCEPTED_FILE_TYPES = "image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const bugSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical", "production_bug"]),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
});

export type BugFormValues = z.infer<typeof bugSchema>;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
  { value: "production_bug", label: "Prod Issue" },
];

interface AssigneeOption {
  value: string;
  label: string;
}

interface AddBugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BugFormValues, files: File[]) => void;
  isLoading?: boolean;
  assigneeOptions?: AssigneeOption[];
}

export function AddBugDialog({ open, onOpenChange, onSubmit, isLoading, assigneeOptions = [] }: AddBugDialogProps) {
  const defaultValues: BugFormValues = { title: "", description: "", priority: "medium", assignee_id: "__none__", due_date: "" };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BugFormValues>({
    resolver: zodResolver(bugSchema),
    defaultValues,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) {
      reset(defaultValues);
      setPendingFiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const currentPriority = watch("priority");
  const currentAssignee = watch("assignee_id");

  const allAssigneeOptions: AssigneeOption[] = [
    { value: "__none__", label: "Unassigned" },
    ...assigneeOptions,
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) setPendingFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (values: BugFormValues) => {
    onSubmit(
      {
        ...values,
        assignee_id: values.assignee_id === "__none__" ? undefined : values.assignee_id,
        due_date: values.due_date || undefined,
      },
      pendingFiles,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Report Bug</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <div className="space-y-2">
            <BaseLabel htmlFor="bug-title">Title</BaseLabel>
            <BaseInput
              id="bug-title"
              placeholder="Bug title..."
              {...register("title")}
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <BaseLabel htmlFor="bug-description">Description</BaseLabel>
            <BaseTextarea
              id="bug-description"
              placeholder="Steps to reproduce, expected vs actual behavior..."
              className="resize-none"
              rows={4}
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Priority"
              placeholder="Select priority"
              options={PRIORITY_OPTIONS}
              value={currentPriority}
              onValueChange={(v) => setValue("priority", v as TaskPriority)}
            />
            <SelectField
              label="Assigned To"
              placeholder="Select assignee"
              options={allAssigneeOptions}
              value={currentAssignee || "__none__"}
              onValueChange={(v) => setValue("assignee_id", v)}
            />
          </div>

          <div className="space-y-2">
            <BaseLabel htmlFor="bug-due-date">Due Date</BaseLabel>
            <BaseInput
              id="bug-due-date"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              {...register("due_date")}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Paperclip className="h-4 w-4" />
                Attachments
                {pendingFiles.length > 0 && (
                  <span className="text-xs text-muted-foreground">({pendingFiles.length})</span>
                )}
              </span>
              <BaseButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs h-7"
              >
                <Upload className="h-3 w-3 mr-1" /> Upload
              </BaseButton>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileSelect}
              />
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-1">
                {pendingFiles.map((file, i) => {
                  const isImg = file.type.startsWith("image/");
                  return (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
                    >
                      {isImg ? (
                        <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      )}
                      <span className="flex-1 truncate font-medium">{file.name}</span>
                      <span className="text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <BaseButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={isLoading}>
              {isLoading ? "Reporting..." : "Report Bug"}
            </BaseButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
