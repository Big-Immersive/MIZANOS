"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/layout/Dialog";
import { Button } from "@/components/molecules/buttons/Button";

const SAFE_STATUSES = new Set(["draft", "backlog", "cancelled"]);

interface DeleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  taskStatus: string;
  onConfirm: () => void;
  isPending?: boolean;
  subtaskCount?: number;
}

export function DeleteTaskDialog({
  open,
  onOpenChange,
  taskTitle,
  taskStatus,
  onConfirm,
  isPending = false,
  subtaskCount = 0,
}: DeleteTaskDialogProps) {
  const isSafe = SAFE_STATUSES.has(taskStatus);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Task</DialogTitle>
          <DialogDescription>
            {isSafe
              ? `Are you sure you want to delete "${taskTitle}"? This action cannot be undone.`
              : `"${taskTitle}" is currently ${taskStatus.replace("_", " ")}. Deleting an active task will permanently remove all associated data.`}
          </DialogDescription>
        </DialogHeader>

        {subtaskCount > 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            This task has {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""} that will also be permanently deleted.
          </p>
        )}

        {!isSafe && (
          <label className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 accent-destructive"
            />
            <span className="text-destructive/90">
              I fully understand the risk of deleting this active task
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending || (!isSafe && !acknowledged)}
            loading={isPending}
          >
            Delete Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
