"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import { useChecklistTemplateDetail, useChecklistCategories } from "@/hooks/queries/useChecklistTemplates";
import {
  useAddChecklistTemplateItem,
  useBulkAddChecklistTemplateItems,
  useUpdateChecklistTemplateItem,
  useDeleteChecklistTemplateItem,
  useCreateChecklistCategory,
} from "@/hooks/mutations/useChecklistTemplateMutations";
import { CHECKLIST_STATUS_LABELS } from "@/lib/types/checklist-template";
import { BaseTextarea } from "@/components/atoms/inputs/BaseTextarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/atoms/layout/Dialog";
import { ArrowLeft, GripVertical, List, Pencil, Plus, Trash2 } from "lucide-react";

interface Props {
  params: Promise<{ templateId: string }>;
}

export default function ChecklistTemplateDetailPage({ params }: Props) {
  const { templateId } = use(params);
  const { data: template, isLoading } = useChecklistTemplateDetail(templateId);
  const { data: categories = [] } = useChecklistCategories();
  const addItem = useAddChecklistTemplateItem(templateId);
  const bulkAddItems = useBulkAddChecklistTemplateItems(templateId);
  const updateItem = useUpdateChecklistTemplateItem(templateId);
  const deleteItem = useDeleteChecklistTemplateItem(templateId);
  const createCategory = useCreateChecklistCategory();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newStatus, setNewStatus] = useState("new");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("general");

  if (isLoading) return <div className="p-6"><Skeleton className="h-64" /></div>;
  if (!template) return <div className="p-6 text-center text-muted-foreground">Template not found</div>;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const cat = showCustomCat && customCategory.trim() ? customCategory.trim() : newCategory;
    if (showCustomCat && customCategory.trim()) {
      createCategory.mutate(customCategory.trim());
    }
    addItem.mutate({ title: newTitle.trim(), category: cat, default_status: newStatus });
    setNewTitle("");
    setNewCategory("general");
    setNewStatus("new");
    setShowCustomCat(false);
    setCustomCategory("");
  };

  const handleBulkAdd = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    // Auto-detect headings: lines starting with # or lines followed by indented items
    let currentCategory = bulkCategory;
    const items: Array<{ title: string; category: string; default_status: string }> = [];
    for (const line of lines) {
      if (line.startsWith("#")) {
        currentCategory = line.replace(/^#+\s*/, "").trim();
      } else {
        items.push({ title: line, category: currentCategory, default_status: "new" });
      }
    }
    if (items.length === 0) return;
    bulkAddItems.mutate(items);
    setBulkText("");
    setBulkOpen(false);
  };

  const itemCategories = template ? template.items.map((i) => i.category) : [];
  const categoryOptions = ["general", ...categories.map((c) => c.name), ...itemCategories].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/templates" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{template.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs uppercase">{template.template_type}</Badge>
            {template.description && <span className="text-sm text-muted-foreground">{template.description}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Checklist Items ({template.items.length})</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-2 rounded-lg border p-3 bg-secondary/20">
          <BaseInput
            value={newTitle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
            placeholder="Checklist item title..."
            autoFocus
          />
          <div className="flex items-center gap-2">
            {!showCustomCat ? (
              <div className="flex items-center gap-1 flex-1">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowCustomCat(true)}>+ New</Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1">
                <BaseInput value={customCategory} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomCategory(e.target.value)} placeholder="New category..." className="h-8 text-xs" />
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setShowCustomCat(false); setCustomCategory(""); }}>Cancel</Button>
              </div>
            )}
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CHECKLIST_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim() || addItem.isPending}>Add</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {template.items.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No items yet. Click &quot;Add Item&quot; or &quot;Bulk Add&quot; to create checklist items.
          </div>
        )}

        {(() => {
          const grouped: Record<string, typeof template.items> = {};
          for (const item of template.items) {
            const cat = item.category || "general";
            (grouped[cat] ??= []).push(item);
          }
          return Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-1">
              <div className="flex items-center gap-2 py-2 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                <Badge variant="outline" className="text-[9px]">{items.length}</Badge>
              </div>
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-accent/50 group ml-2">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  {editingItemId === item.id ? (
                    <BaseInput
                      value={editTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter" && editTitle.trim()) { updateItem.mutate({ itemId: item.id, title: editTitle.trim() }); setEditingItemId(null); }
                        if (e.key === "Escape") setEditingItemId(null);
                      }}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm">{item.title}</span>
                  )}
                  <Badge variant="secondary" className="text-[9px] shrink-0">{CHECKLIST_STATUS_LABELS[item.default_status] ?? item.default_status}</Badge>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => { setEditingItemId(item.id); setEditTitle(item.title); }} className="p-1 rounded hover:bg-accent">
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteItem.mutate(item.id)} className="p-1 rounded hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ));
        })()}
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Add Checklist Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use <code className="text-xs bg-muted px-1 rounded">#</code> to create category headings. Items below a heading belong to that category.
            </p>
            <BaseTextarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"# Functional Testing\nAll core features work as per spec\nForm validations enforce required fields\n\n# Security\nNo sensitive data exposed in console\nHTTPS enforced on all environments"}
              rows={12}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Default category (items without #):</span>
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">
                {bulkText.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length} items,{" "}
                {bulkText.split("\n").filter((l) => l.trim().startsWith("#")).length} categories
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                <Button onClick={handleBulkAdd} disabled={!bulkText.trim() || addItem.isPending}>
                  Add All
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
