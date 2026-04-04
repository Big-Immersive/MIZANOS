"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import { CHECKLIST_STATUS_LABELS } from "@/lib/types/checklist-template";
import type { ProjectChecklistItem } from "@/lib/types/checklist-template";
import { Circle, CheckCircle2, ClipboardPlus, Trash2, User } from "lucide-react";

interface ChecklistItemRowProps {
  item: ProjectChecklistItem;
  profiles: Array<{ id: string; full_name?: string | null; email?: string | null }>;
  onUpdate: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onCreateTask: () => void;
}

export function ChecklistItemRow({ item, profiles, onUpdate, onDelete, onCreateTask }: ChecklistItemRowProps) {
  const isComplete = item.status === "complete";

  return (
    <div className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
      <button
        type="button"
        onClick={() => onUpdate({ status: isComplete ? "new" : "complete" })}
        className="shrink-0"
      >
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/50 hover:text-primary/70" />
        )}
      </button>
      <span className={`flex-1 text-sm ${isComplete ? "line-through text-muted-foreground" : ""}`}>
        {item.title}
      </span>

      {item.assignee_name && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <User className="h-2.5 w-2.5" /> {item.assignee_name}
        </span>
      )}

      {item.due_date && (
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {new Date(item.due_date).toLocaleDateString()}
        </span>
      )}

      <Select value={item.status} onValueChange={(v) => onUpdate({ status: v })}>
        <SelectTrigger className="h-6 w-[100px] text-[10px] border-muted shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CHECKLIST_STATUS_LABELS).map(([val, label]) => (
            <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={item.assignee_id ?? "__none__"}
        onValueChange={(v) => onUpdate({ assignee_id: v === "__none__" ? null : v })}
      >
        <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent [&>svg]:hidden opacity-0 group-hover:opacity-100 shrink-0">
          <User className="h-3 w-3 text-muted-foreground" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Unassigned</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email ?? "Unknown"}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={onCreateTask}
        className="p-0.5 rounded hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="Create marketing task from this item"
      >
        <ClipboardPlus className="h-3 w-3 text-muted-foreground hover:text-primary" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}
