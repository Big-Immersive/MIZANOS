"use client";

import { useState } from "react";
import { UserPlus, Calendar, ArrowUpDown, Activity, Layers, Trash2 } from "lucide-react";
import { BaseCheckbox } from "@/components/atoms/inputs/BaseCheckbox";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { Button } from "@/components/molecules/buttons/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/atoms/layout/Popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import { DeleteTaskDialog } from "@/components/molecules/feedback/DeleteTaskDialog";
import { useProductMembers } from "@/hooks/queries/useProductMembers";
import { useBulkUpdateTasks, useDeleteTask } from "@/hooks/mutations/useTaskMutations";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";

interface BulkActionsToolbarProps {
  taskCount: number;
  selectedIds: Set<string>;
  onToggleAll: () => void;
  onClearSelection: () => void;
  productId: string;
}

const UNASSIGNED_VALUE = "__unassigned__";

export function BulkActionsToolbar({
  taskCount,
  selectedIds,
  onToggleAll,
  onClearSelection,
  productId,
}: BulkActionsToolbarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { data: members = [] } = useProductMembers(productId);
  const bulkUpdate = useBulkUpdateTasks(productId);
  const deleteTask = useDeleteTask(productId);
  const { isAdmin, isProjectManager, isEngineer } = useRoleVisibility();
  const isAIEngineerOnly = isEngineer && !isAdmin && !isProjectManager;
  const canManageTasks = isAdmin || isProjectManager || isEngineer;
  const canDelete = canManageTasks && !isAIEngineerOnly;
  const canEditDueDate = canManageTasks && !isAIEngineerOnly;

  const allSelected = taskCount > 0 && selectedIds.size === taskCount;
  const hasSelection = selectedIds.size > 0;
  const taskIds = [...selectedIds];

  const applyUpdate = (updates: Record<string, unknown>) => {
    bulkUpdate.mutate(
      { taskIds, updates },
      { onSuccess: onClearSelection },
    );
  };

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    const deleteNext = (i: number) => {
      if (i >= ids.length) {
        setDeleteDialogOpen(false);
        onClearSelection();
        return;
      }
      deleteTask.mutate(ids[i], { onSuccess: () => deleteNext(i + 1) });
    };
    deleteNext(0);
  };

  const uniqueMembers = Array.from(new Map(members.map((m) => [m.profile_id, m])).values());

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 flex-wrap">
        <BaseCheckbox checked={allSelected} onCheckedChange={onToggleAll} />
        <span className="text-sm font-medium">
          {hasSelection
            ? `${selectedIds.size} of ${taskCount} selected`
            : `${taskCount} task${taskCount !== 1 ? "s" : ""}`}
        </span>

        {canManageTasks && (
          <>
            <span className="text-xs text-muted-foreground border-l pl-2 ml-1">Bulk:</span>

            {/* Assign */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent" onClick={() => applyUpdate({ assignee_id: null })}>Unassigned</button>
                  {uniqueMembers.map((m) => (
                    <button key={m.profile_id} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent truncate" onClick={() => applyUpdate({ assignee_id: m.profile_id })}>
                      {m.profile?.full_name ?? "Unknown"}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Due Date */}
            {canEditDueDate && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Calendar className="h-3.5 w-3.5 mr-1" /> Due Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <BaseInput
                    type="date"
                    className="h-8 text-xs"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.value) applyUpdate({ due_date: e.target.value });
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Priority */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Priority
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-2" align="start">
                <div className="space-y-1">
                  {[["low", "Low"], ["medium", "Medium"], ["high", "High"]].map(([val, label]) => (
                    <button key={val} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent" onClick={() => applyUpdate({ priority: val })}>{label}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Status */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Activity className="h-3.5 w-3.5 mr-1" /> Status
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2" align="start">
                <div className="space-y-1">
                  {[["backlog", "Backlog"], ["in_progress", "In Progress"], ["review", "Review"], ["done", "Done"], ["live", "Live"], ["cancelled", "Cancelled"]].map(([val, label]) => (
                    <button key={val} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent" onClick={() => applyUpdate({ status: val })}>{label}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Vertical */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Layers className="h-3.5 w-3.5 mr-1" /> Vertical
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2" align="start">
                <div className="space-y-1">
                  {[["business", "Business"], ["marketing", "Marketing"], ["development", "Development"], ["product", "Product"]].map(([val, label]) => (
                    <button key={val} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent" onClick={() => applyUpdate({ pillar: val })}>{label}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Delete */}
            {canDelete && (
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            )}
          </>
        )}
      </div>

      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        taskTitle={`${selectedIds.size} selected task${selectedIds.size !== 1 ? "s" : ""}`}
        taskStatus=""
        subtaskCount={0}
        isPending={deleteTask.isPending}
        onConfirm={handleBulkDelete}
      />
    </>
  );
}
