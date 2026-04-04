"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/atoms/layout/Sheet";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { BaseTextarea } from "@/components/atoms/inputs/BaseTextarea";
import { Button } from "@/components/molecules/buttons/Button";
import { Badge } from "@/components/atoms/display/Badge";
import { Card, CardContent } from "@/components/atoms/display/Card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import { SearchableSelect } from "@/components/molecules/forms/SearchableSelect";
import type { Task } from "@/lib/types";
import { Trash2, Calendar, User, CheckCircle2, Circle, ClipboardList } from "lucide-react";

interface MarketingTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  assigneeOptions: Array<{ value: string; label: string }>;
  onSave: (data: { title?: string; description?: string; status?: string; assignee_id?: string | null; due_date?: string | null }) => void;
  onDelete: () => void;
  isSaving?: boolean;
}

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned", color: "bg-muted text-muted-foreground" },
  { value: "in_execution", label: "In Execution", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  { value: "completed", label: "Completed", color: "bg-green-500/10 text-green-500 border-green-500/30" },
];

export function MarketingTaskDrawer({ open, onOpenChange, task, assigneeOptions, onSave, onDelete, isSaving }: MarketingTaskDrawerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (task && open) {
      setTitle(task.title ?? "");
      setDescription(task.description ?? "");
      setStatus(task.status ?? "planned");
      setAssigneeId(task.assignee_id ?? "");
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "");
    }
  }, [task, open]);

  const handleSave = () => {
    onSave({
      title: title.trim(), description: description.trim(), status,
      assignee_id: assigneeId || null, due_date: dueDate || null,
    });
    onOpenChange(false);
  };

  if (!task) return null;

  const isComplete = status === "completed";
  const createdAt = task.created_at ? new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const statusConfig = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <SheetTitle className="text-base">Task Details</SheetTitle>
          </div>
          <p className="text-xs text-muted-foreground">Created {createdAt}</p>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status card */}
          <Card>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStatus(isComplete ? "planned" : "completed")}>
                  {isComplete
                    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                    : <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary/70 transition-colors" />
                  }
                </button>
                <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>{statusConfig.label}</Badge>
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Title */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Title</p>
            <BaseInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title..." />
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Description</p>
            <BaseTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              className="resize-y w-full box-border text-sm"
              placeholder="Add details about this task..."
            />
          </div>

          {/* Assignee & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <User className="h-3 w-3" /> Assignee
              </p>
              <SearchableSelect
                placeholder="Select..."
                options={assigneeOptions}
                value={assigneeId}
                onValueChange={setAssigneeId}
                allowClear
                clearLabel="Unassigned"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Due Date
              </p>
              <BaseInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { onDelete(); onOpenChange(false); }}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || isSaving}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
