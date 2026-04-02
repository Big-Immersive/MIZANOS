"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { BaseLabel } from "@/components/atoms/inputs/BaseLabel";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/atoms/layout/Dialog";
import { useChecklistTemplates } from "@/hooks/queries/useChecklistTemplates";
import {
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  useDeleteChecklistTemplate,
} from "@/hooks/mutations/useChecklistTemplateMutations";
import { CHECKLIST_TEMPLATE_TYPES } from "@/lib/types/checklist-template";
import type { ChecklistTemplate } from "@/lib/types/checklist-template";
import { CheckSquare, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

const TYPE_TABS = [
  { id: "all", label: "All" },
  ...CHECKLIST_TEMPLATE_TYPES.map((t) => ({ id: t.value, label: t.label })),
];

export function ChecklistTemplateSection() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("gtm");
  const [formDesc, setFormDesc] = useState("");
  const [customType, setCustomType] = useState("");
  const [showCustomType, setShowCustomType] = useState(false);

  const { data: templates, isLoading } = useChecklistTemplates(typeFilter === "all" ? undefined : typeFilter);
  const createTemplate = useCreateChecklistTemplate();
  const updateTemplate = useUpdateChecklistTemplate();
  const deleteTemplate = useDeleteChecklistTemplate();

  const handleAdd = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormType("gtm");
    setFormDesc("");
    setShowCustomType(false);
    setEditorOpen(true);
  };

  const handleEdit = (t: ChecklistTemplate) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormType(t.template_type);
    setFormDesc(t.description ?? "");
    setShowCustomType(!CHECKLIST_TEMPLATE_TYPES.some((ct) => ct.value === t.template_type));
    if (!CHECKLIST_TEMPLATE_TYPES.some((ct) => ct.value === t.template_type)) {
      setCustomType(t.template_type);
    }
    setEditorOpen(true);
  };

  const handleSave = () => {
    const finalType = showCustomType && customType.trim() ? customType.trim().toLowerCase().replace(/\s+/g, "_") : formType;
    if (!formName.trim() || !finalType) return;
    const data = { name: formName.trim(), template_type: finalType, description: formDesc.trim() || undefined };
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, ...data }, { onSuccess: () => setEditorOpen(false) });
    } else {
      createTemplate.mutate(data, { onSuccess: () => setEditorOpen(false) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> Checklist Templates
        </h2>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" /> New Checklist Template
        </Button>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              typeFilter === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>}

      {!isLoading && templates && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Link href={`/templates/checklist/${t.id}`}>
                    <CardTitle className="text-sm hover:text-primary cursor-pointer">{t.name}</CardTitle>
                  </Link>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(t)} className="p-1 rounded hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button onClick={() => deleteTemplate.mutate(t.id)} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] uppercase">{t.template_type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.item_count} items</Badge>
                  {!t.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && (!templates || templates.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No Checklist Templates</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first checklist template to get started.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Checklist Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <BaseLabel>Template Name</BaseLabel>
              <BaseInput value={formName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)} placeholder="e.g., GTM checklist for SaaS v1" />
            </div>
            <div>
              <BaseLabel>Template Type</BaseLabel>
              {!showCustomType ? (
                <div className="flex items-center gap-2">
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHECKLIST_TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setShowCustomType(true)}>Custom</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <BaseInput value={customType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomType(e.target.value)} placeholder="Custom type..." />
                  <Button variant="outline" size="sm" onClick={() => { setShowCustomType(false); setCustomType(""); }}>Cancel</Button>
                </div>
              )}
            </div>
            <div>
              <BaseLabel>Description (optional)</BaseLabel>
              <BaseInput value={formDesc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormDesc(e.target.value)} placeholder="Brief description..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!formName.trim() || createTemplate.isPending || updateTemplate.isPending}>
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
