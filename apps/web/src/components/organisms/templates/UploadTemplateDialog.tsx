"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checklistTemplatesRepository } from "@/lib/api/repositories/checklist-templates.repository";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { BaseLabel } from "@/components/atoms/inputs/BaseLabel";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/atoms/layout/Dialog";
import { CHECKLIST_TEMPLATE_TYPES, CHECKLIST_STATUS_LABELS } from "@/lib/types/checklist-template";
import { Upload, FileText, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface UploadTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedItem {
  title: string;
  category: string;
  default_status: string;
}

export function UploadTemplateDialog({ open, onOpenChange }: UploadTemplateDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("gtm");
  const [items, setItems] = useState<ParsedItem[]>([]);

  const parseMutation = useMutation({
    mutationFn: (file: File) => checklistTemplatesRepository.uploadPreview(file),
    onSuccess: (data) => {
      setTemplateName(data.template_name);
      setTemplateType(data.template_type || "gtm");
      setItems(data.items);
      setStep("preview");
    },
    onError: (e: Error) => toast.error("Failed to parse file: " + e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: () => checklistTemplatesRepository.uploadConfirm({
      template_name: templateName,
      template_type: templateType,
      items,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      setStep("done");
      toast.success(`Template created with ${items.length} items`);
    },
    onError: (e: Error) => toast.error("Failed to create template: " + e.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    parseMutation.mutate(file);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("upload");
      setFileName("");
      setTemplateName("");
      setTemplateType("gtm");
      setItems([]);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Upload Template File"}
            {step === "preview" && "Preview Extracted Items"}
            {step === "done" && "Template Created"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {parseMutation.isPending ? (
                <div className="space-y-2">
                  <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    {fileName.endsWith(".csv") ? "Parsing CSV..." : "AI is extracting checklist items..."}
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports CSV, PDF, DOCX, TXT files
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf,.docx,.doc,.txt,.md"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="rounded-lg border p-3 bg-secondary/20 space-y-2">
              <p className="text-xs font-medium">CSV Format (recommended):</p>
              <code className="text-[10px] text-muted-foreground block">
                title,category,type,status{"\n"}
                Create landing page,marketing,gtm,new{"\n"}
                Write unit tests,testing,qa,new{"\n"}
                Setup CI/CD,devops,development,new
              </code>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{fileName}</span>
              <Badge variant="secondary">{items.length} items extracted</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <BaseLabel>Template Name</BaseLabel>
                <BaseInput
                  value={templateName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplateName(e.target.value)}
                />
              </div>
              <div>
                <BaseLabel>Template Type</BaseLabel>
                <Select value={templateType} onValueChange={setTemplateType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHECKLIST_TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2">Extracted Items:</p>
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-md border text-sm group">
                  <span className="flex-1 truncate">{item.title}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{item.category}</Badge>
                  <Badge variant="secondary" className="text-[9px] shrink-0">
                    {CHECKLIST_STATUS_LABELS[item.default_status] ?? item.default_status}
                  </Badge>
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    className="p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No items were auto-extracted. You can still create the template and add items manually.
                  </p>
                  <div className="flex items-center gap-2 max-w-md mx-auto">
                    <input
                      type="text"
                      placeholder="Add item manually..."
                      className="flex-1 h-8 px-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                          setItems((prev) => [...prev, { title: (e.target as HTMLInputElement).value.trim(), category: "general", default_status: "new" }]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                    <p className="text-[10px] text-muted-foreground">Press Enter to add</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={!templateName.trim() || confirmMutation.isPending}
                >
                  {confirmMutation.isPending ? "Creating..." : `Create Template (${items.length} items)`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-status-healthy" />
            <h3 className="text-lg font-medium">Template Created!</h3>
            <p className="text-sm text-muted-foreground">
              "{templateName}" with {items.length} checklist items
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
