"use client";

import { Badge } from "@/components/atoms/display/Badge";
import { BaseCheckbox } from "@/components/atoms/inputs/BaseCheckbox";
import { ClaudeCodePrompt } from "@/components/molecules/tasks/ClaudeCodePrompt";
import { TASK_STATUS_DISPLAY, TASK_PRIORITY_COLORS, type TaskStatusConfig } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { MessageSquare, User } from "lucide-react";

interface TaskRowProps {
  task: Task;
  selected: boolean;
  assigneeName?: string;
  onToggle: () => void;
  onClick: () => void;
  statusDisplay?: Record<string, TaskStatusConfig>;
}

export function TaskRow({ task, selected, assigneeName, onToggle, onClick, statusDisplay }: TaskRowProps) {
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
        <div onClick={(e) => e.stopPropagation()}>
          <BaseCheckbox checked={selected} onCheckedChange={onToggle} />
        </div>
        <StatusIcon className={`h-5 w-5 shrink-0 ${statusConfig.color}`} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {task.priority && (
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
          <Badge variant="outline" className="text-xs">
            {statusConfig.label}
          </Badge>
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
