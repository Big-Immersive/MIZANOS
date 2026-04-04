"use client";

import { Badge } from "@/components/atoms/display/Badge";
import { BaseCheckbox } from "@/components/atoms/inputs/BaseCheckbox";
import { ClaudeCodePrompt } from "@/components/molecules/tasks/ClaudeCodePrompt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import { TASK_STATUS_DISPLAY, TASK_PRIORITY_COLORS, type TaskStatusConfig } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { ListChecks, MessageSquare, User } from "lucide-react";

interface TaskRowProps {
  task: Task;
  selected: boolean;
  assigneeName?: string;
  checklistAssignees?: string[];
  onToggle: () => void;
  onClick: () => void;
  onStatusChange?: (taskId: string, status: string) => void;
  statusDisplay?: Record<string, TaskStatusConfig>;
  hideCheckbox?: boolean;
  hidePriority?: boolean;
  hideStatusIcon?: boolean;
}

export function TaskRow({ task, selected, assigneeName, checklistAssignees, onToggle, onClick, onStatusChange, statusDisplay, hideCheckbox, hidePriority, hideStatusIcon }: TaskRowProps) {
  const display = statusDisplay ?? TASK_STATUS_DISPLAY;
  const fallbackKey = statusDisplay ? Object.keys(display)[0] : "backlog";
  const statusConfig = display[task.status ?? fallbackKey] ?? display[fallbackKey];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 p-3">
        {!hideCheckbox && (
          <div onClick={(e) => e.stopPropagation()}>
            <BaseCheckbox checked={selected} onCheckedChange={onToggle} />
          </div>
        )}
        {!hideStatusIcon && <StatusIcon className={`h-5 w-5 shrink-0 ${statusConfig.color}`} />}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {!hidePriority && task.priority && (
              <Badge
                variant="secondary"
                className={`text-[10px] ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}
              >
                {task.priority}
              </Badge>
            )}
            {task.domain_group && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {task.domain_group}
              </Badge>
            )}
            {task.due_date && (
              <span className="text-xs text-muted-foreground tabular-nums">
                Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.comment_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span className="font-medium">{task.comment_count}</span>
                {task.reply_count > 0 && (
                  <>
                    <span>&middot;</span>
                    <span className="text-[10px]">{task.reply_count} {task.reply_count === 1 ? "reply" : "replies"}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            {assigneeName ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground max-w-[120px] truncate">
                <User className="h-3 w-3 shrink-0" />
                {assigneeName}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10px] font-bold shrink-0">?</span>
                Unassigned
              </span>
            )}
            {checklistAssignees && checklistAssignees.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-primary/70">
                <ListChecks className="h-2.5 w-2.5 shrink-0" />
                {checklistAssignees.slice(0, 2).join(", ")}
                {checklistAssignees.length > 2 && ` +${checklistAssignees.length - 2}`}
              </span>
            )}
          </div>
          {onStatusChange ? (
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={task.status ?? "backlog"}
                onValueChange={(v) => onStatusChange(task.id, v)}
              >
                <SelectTrigger className="h-7 w-[110px] text-xs border-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(display).map(([value, cfg]) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge variant="outline" className="text-xs">
              {statusConfig.label}
            </Badge>
          )}
        </div>
      </div>
      {task.claude_code_prompt && (
        <div className="px-3 pb-3">
          <ClaudeCodePrompt prompt={task.claude_code_prompt} />
        </div>
      )}
    </div>
  );
}
