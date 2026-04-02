"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import { useProjectChecklists } from "@/hooks/queries/useProjectChecklists";
import { useChecklistTemplates } from "@/hooks/queries/useChecklistTemplates";
import { useProfiles } from "@/hooks/queries/useProfiles";
import { useApplyChecklistTemplate } from "@/hooks/mutations/useChecklistTemplateMutations";
import {
  useUpdateProjectChecklistItem,
  useDeleteProjectChecklistItem,
  useAddProjectChecklistItem,
  useDeleteProjectChecklist,
} from "@/hooks/mutations/useProjectChecklistMutations";
import { CHECKLIST_STATUS_LABELS } from "@/lib/types/checklist-template";
import type { ProjectChecklist, ProjectChecklistItem } from "@/lib/types/checklist-template";
import { CheckSquare, ListChecks, Plus, Trash2, User } from "lucide-react";

interface ProjectChecklistViewProps {
  productId: string;
  checklistType: string;
  title?: string;
}

export function ProjectChecklistView({ productId, checklistType, title }: ProjectChecklistViewProps) {
  const { data: checklists, isLoading } = useProjectChecklists(productId, checklistType);
  const { data: templates = [] } = useChecklistTemplates(checklistType);
  const { data: profiles = [] } = useProfiles();
  const applyTemplate = useApplyChecklistTemplate();
  const deleteChecklist = useDeleteProjectChecklist(productId);
  const updateItem = useUpdateProjectChecklistItem(productId);
  const deleteItem = useDeleteProjectChecklistItem(productId);
  const addItem = useAddProjectChecklistItem(productId);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");

  if (isLoading) return <Skeleton className="h-48" />;

  const activeTemplates = templates.filter((t) => t.is_active);
  const hasChecklists = checklists && checklists.length > 0;

  return (
    <div className="space-y-4">
      {!hasChecklists && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center space-y-4">
            <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-medium">No {title ?? "Checklists"} Yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Apply a template to get started.</p>
            </div>
            {activeTemplates.length > 0 && (
              <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Choose template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.item_count} items)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedTemplate || applyTemplate.isPending}
                  onClick={() => applyTemplate.mutate({ templateId: selectedTemplate, productId })}
                >
                  Apply
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasChecklists && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> {title ?? "Checklists"}
            </h3>
            {activeTemplates.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-8 text-xs w-[200px]">
                    <SelectValue placeholder="Apply template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" variant="outline"
                  disabled={!selectedTemplate || applyTemplate.isPending}
                  onClick={() => { applyTemplate.mutate({ templateId: selectedTemplate, productId }); setSelectedTemplate(""); }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Apply
                </Button>
              </div>
            )}
          </div>

          {checklists!.map((cl) => (
            <ChecklistCard
              key={cl.id}
              checklist={cl}
              profiles={profiles}
              onUpdateItem={(itemId, data) => updateItem.mutate({ itemId, ...data })}
              onDeleteItem={(itemId) => deleteItem.mutate(itemId)}
              onDeleteChecklist={() => deleteChecklist.mutate(cl.id)}
              showAddItem={showAddItem === cl.id}
              onToggleAddItem={() => setShowAddItem(showAddItem === cl.id ? null : cl.id)}
              newItemTitle={newItemTitle}
              onNewItemTitleChange={setNewItemTitle}
              onAddItem={() => {
                if (!newItemTitle.trim()) return;
                addItem.mutate({ checklistId: cl.id, title: newItemTitle.trim() });
                setNewItemTitle("");
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ChecklistCard({
  checklist, profiles, onUpdateItem, onDeleteItem, onDeleteChecklist,
  showAddItem, onToggleAddItem, newItemTitle, onNewItemTitleChange, onAddItem,
}: {
  checklist: ProjectChecklist;
  profiles: Array<{ id: string; full_name?: string | null; email?: string | null }>;
  onUpdateItem: (itemId: string, data: Record<string, unknown>) => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteChecklist: () => void;
  showAddItem: boolean;
  onToggleAddItem: () => void;
  newItemTitle: string;
  onNewItemTitleChange: (v: string) => void;
  onAddItem: () => void;
}) {
  const completed = checklist.completed_count;
  const total = checklist.item_count;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {checklist.name}
            <Badge variant="secondary" className="text-[10px]">{completed}/{total}</Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onToggleAddItem}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDeleteChecklist}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-1">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {checklist.items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            profiles={profiles}
            onUpdate={(data) => onUpdateItem(item.id, data)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
        {showAddItem && (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newItemTitle}
              onChange={(e) => onNewItemTitleChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onAddItem(); }}
              placeholder="New checklist item..."
              className="flex-1 h-8 px-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            <Button size="sm" onClick={onAddItem} disabled={!newItemTitle.trim()}>Add</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistItemRow({
  item, profiles, onUpdate, onDelete,
}: {
  item: ProjectChecklistItem;
  profiles: Array<{ id: string; full_name?: string | null; email?: string | null }>;
  onUpdate: (data: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const isComplete = item.status === "complete";

  return (
    <div className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
      <span className={`flex-1 text-sm ${isComplete ? "line-through text-muted-foreground" : ""}`}>
        {item.title}
      </span>

      {item.category !== "general" && (
        <Badge variant="outline" className="text-[9px] shrink-0">{item.category}</Badge>
      )}

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
        onClick={onDelete}
        className="p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}
