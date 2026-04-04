"use client";

import { Circle, CheckCircle2, User, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import type { Task } from "@/lib/types";

interface MarketingTaskRowProps {
  task: Task;
  assigneeName?: string;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onClick: () => void;
}

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_execution", label: "In Execution" },
  { value: "completed", label: "Completed" },
];

export function MarketingTaskRow({ task, assigneeName, onStatusChange, onDelete, onClick }: MarketingTaskRowProps) {
  const isComplete = task.status === "completed";

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors group">
      <button
        type="button"
        onClick={() => onStatusChange(isComplete ? "planned" : "completed")}
        className="shrink-0 mt-0.5"
      >
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary/70" />
        )}
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <p className={`text-sm font-medium ${isComplete ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {assigneeName && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" /> {assigneeName}
          </span>
        )}

        <Select value={task.status ?? "planned"} onValueChange={onStatusChange}>
          <SelectTrigger className="h-7 w-[120px] text-xs border-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  );
}
