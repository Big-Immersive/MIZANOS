"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/display/Badge";
import { TaskRow } from "@/components/molecules/tasks/TaskRow";
import { AddMarketingTaskDialog } from "./AddMarketingTaskDialog";
import { useSubtasks } from "@/hooks/queries/useMarketingTasks";
import { useCreateSubtask } from "@/hooks/mutations/useMarketingTaskMutations";
import { MARKETING_TASK_STATUS_DISPLAY } from "@/lib/constants";
import type { Task, KanbanTask } from "@/lib/types";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";

interface MarketingTaskRowProps {
  task: Task;
  selected: boolean;
  assigneeName?: string;
  assigneeMap: Map<string, string>;
  assigneeOptions: { value: string; label: string }[];
  productId: string;
  onToggle: () => void;
  onClick: () => void;
}

export function MarketingTaskRow({
  task, selected, assigneeName, assigneeMap, assigneeOptions, productId, onToggle, onClick,
}: MarketingTaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const { data: subtasks = [] } = useSubtasks(expanded ? task.id : "");
  const createSubtask = useCreateSubtask(productId, task.id);
  const subtaskCount = task.subtask_count ?? 0;

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="p-1 rounded hover:bg-accent/50 shrink-0"
          aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
        >
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0 relative">
          <TaskRow
            task={task}
            selected={selected}
            assigneeName={assigneeName}
            onToggle={onToggle}
            onClick={onClick}
            statusDisplay={MARKETING_TASK_STATUS_DISPLAY}
          />
          {subtaskCount > 0 && (
            <Badge variant="secondary" className="absolute top-3 right-28 text-[10px]">
              {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {expanded && (
        <div className="ml-8 mt-1 space-y-1 border-l-2 border-muted pl-3 pb-2">
          {subtasks.map((sub) => (
            <TaskRow
              key={sub.id}
              task={sub}
              selected={false}
              assigneeName={sub.assignee_id ? assigneeMap.get(sub.assignee_id) : undefined}
              onToggle={() => {}}
              onClick={onClick}
              statusDisplay={MARKETING_TASK_STATUS_DISPLAY}
            />
          ))}
          <button
            type="button"
            onClick={() => setAddSubOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Subtask
          </button>
        </div>
      )}

      <AddMarketingTaskDialog
        open={addSubOpen}
        onOpenChange={setAddSubOpen}
        isLoading={createSubtask.isPending}
        assigneeOptions={assigneeOptions}
        isSubtask
        onSubmit={(data) => {
          createSubtask.mutate(data, { onSuccess: () => setAddSubOpen(false) });
        }}
      />
    </div>
  );
}
