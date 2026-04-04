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
import { CheckSquare, Circle, CheckCircle2, ClipboardPlus, ListChecks, Plus, Trash2, User } from "lucide-react";
import { useCreateMarketingTask } from "@/hooks/mutations/useMarketingTaskMutations";
import { ChecklistItemRow } from "./ChecklistItemRow";
import { toast } from "sonner";

interface ProjectChecklistViewProps {
  productId: string;
  checklistType: string;
  title?: string;
  onCreateTaskFromItem?: (title: string) => void;
}

export function ProjectChecklistView({ productId, checklistType, title, onCreateTaskFromItem }: ProjectChecklistViewProps) {
  const { data: checklists, isLoading } = useProjectChecklists(productId, checklistType);
  const { data: templates = [] } = useChecklistTemplates(checklistType);
  const { data: profiles = [] } = useProfiles();
  const applyTemplate = useApplyChecklistTemplate();
  const deleteChecklist = useDeleteProjectChecklist(productId);
  const updateItem = useUpdateProjectChecklistItem(productId);
  const deleteItem = useDeleteProjectChecklistItem(productId);
  const addItem = useAddProjectChecklistItem(productId);
  const createTask = useCreateMarketingTask(productId);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("general");
  const [newItemStatus, setNewItemStatus] = useState("new");

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

          {checklists!.map((cl) => {
            const isAdding = showAddItem === cl.id;
            const existingCats = [...new Set(cl.items.map((i) => i.category || "general"))];
            const categoryOptions = ["general", ...existingCats].filter((v, i, a) => a.indexOf(v) === i);
            return (
              <div key={cl.id} className="space-y-2">
                {isAdding && (
                  <Card className="border-primary/30">
                    <CardContent className="p-3 space-y-2">
                      <input
                        type="text" value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newItemTitle.trim()) {
                            addItem.mutate({ checklistId: cl.id, title: newItemTitle.trim(), category: newItemCategory, status: newItemStatus });
                            setNewItemTitle(""); setNewItemCategory("general"); setNewItemStatus("new");
                          }
                          if (e.key === "Escape") setShowAddItem(null);
                        }}
                        placeholder="Checklist item title..." autoFocus
                        className="w-full h-8 px-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex items-center gap-2">
                        <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Category" /></SelectTrigger>
                          <SelectContent>{categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={newItemStatus} onValueChange={setNewItemStatus}>
                          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(CHECKLIST_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => {
                          if (!newItemTitle.trim()) return;
                          addItem.mutate({ checklistId: cl.id, title: newItemTitle.trim(), category: newItemCategory, status: newItemStatus });
                          setNewItemTitle(""); setNewItemCategory("general"); setNewItemStatus("new");
                        }} disabled={!newItemTitle.trim()}>Add</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowAddItem(null)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <ChecklistCard
                  checklist={cl} profiles={profiles}
                  onUpdateItem={(itemId, data) => updateItem.mutate({ itemId, ...data })}
                  onDeleteItem={(itemId) => deleteItem.mutate(itemId)}
                  onDeleteChecklist={() => deleteChecklist.mutate(cl.id)}
                  onCreateTask={(itemTitle) => {
                    if (onCreateTaskFromItem) { onCreateTaskFromItem(itemTitle); }
                    else { createTask.mutate({ title: itemTitle, status: "planned" }, { onSuccess: () => toast.success("Marketing task created: " + itemTitle) }); }
                  }}
                  onToggleAddItem={() => setShowAddItem(isAdding ? null : cl.id)}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function ChecklistCard({
  checklist, profiles, onUpdateItem, onDeleteItem, onDeleteChecklist, onCreateTask, onToggleAddItem,
}: {
  checklist: ProjectChecklist;
  profiles: Array<{ id: string; full_name?: string | null; email?: string | null }>;
  onUpdateItem: (itemId: string, data: Record<string, unknown>) => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteChecklist: () => void;
  onCreateTask: (title: string) => void;
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
      <CardContent className="space-y-3 pt-0">
        {(() => {
          const grouped: Record<string, typeof checklist.items> = {};
          for (const item of checklist.items) {
            const cat = item.category || "general";
            (grouped[cat] ??= []).push(item);
          }
          return Object.entries(grouped).map(([category, items]) => {
            const done = items.filter((i) => i.status === "complete").length;
            return (
              <div key={category} className="space-y-0.5">
                <div className="flex items-center gap-2 py-1.5 border-b border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</h4>
                  <Badge variant="outline" className="text-[9px]">{done}/{items.length}</Badge>
                </div>
                {items.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    profiles={profiles}
                    onUpdate={(data) => onUpdateItem(item.id, data)}
                    onDelete={() => onDeleteItem(item.id)}
                    onCreateTask={() => onCreateTask(item.title)}
                  />
                ))}
              </div>
            );
          });
        })()}
      </CardContent>
    </Card>
  );
}

