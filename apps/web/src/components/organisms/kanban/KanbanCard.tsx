"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Calendar, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/atoms/display/Card";
import {
  Avatar,
  AvatarFallback,
} from "@/components/atoms/display/Avatar";
import { Badge } from "@/components/atoms/display/Badge";
import type { KanbanTask } from "@/lib/types";
import type { PillarType, TaskPriority } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

const PILLAR_BORDER: Record<PillarType, string> = {
  business: "border-l-pillar-business",
  marketing: "border-l-pillar-marketing",
  development: "border-l-pillar-development",
  product: "border-l-pillar-product",
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-muted-foreground",
  medium: "bg-status-warning",
  high: "bg-status-critical",
  critical: "bg-orange-500",
  production_bug: "bg-purple-500",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  production_bug: "Prod Issue",
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface KanbanCardProps {
  task: KanbanTask;
  isOverlay?: boolean;
  onClick?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function KanbanCard({ task, isOverlay, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const initials =
    task.assignee
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-l-4 p-3 transition-shadow hover:shadow-md",
        PILLAR_BORDER[task.pillar],
        isDragging && "opacity-50 shadow-lg",
        isOverlay && "rotate-2 shadow-xl",
      )}
      onClick={onClick}
    >
      {/* Top row: drag handle + title */}
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Priority dot + title */}
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 flex-shrink-0 rounded-full",
                PRIORITY_DOT[task.priority],
              )}
              title={PRIORITY_LABEL[task.priority]}
            />
            <h4 className="truncate text-sm font-medium text-foreground">
              {task.title}
            </h4>
          </div>

          {/* Description preview */}
          {task.description && (
            <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {PRIORITY_LABEL[task.priority]}
        </Badge>
      </div>

      {/* Footer: assignee + due date */}
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        {task.assignee ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[80px] truncate text-xs text-muted-foreground">
              {task.assignee}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10px] font-bold shrink-0">?</span>
            <span>Unassigned</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {(task.commentCount + task.replyCount) > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{task.commentCount + task.replyCount}</span>
            </div>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="font-mono">{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
