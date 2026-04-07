"use client";

import { useState } from "react";
import { FileDown, FileText, Loader2, CheckCircle2, Bug, ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/atoms/layout/Dialog";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { BaseCheckbox } from "@/components/atoms/inputs/BaseCheckbox";
import { ScrollArea } from "@/components/atoms/layout/ScrollArea";
import { Badge } from "@/components/atoms/display/Badge";
import { cn } from "@/lib/utils/cn";
import { reportsRepository } from "@/lib/api/repositories";
import { toast } from "sonner";
import type { ProjectReportBrief } from "@/lib/types";

type Format = "pdf" | "docx";
type ReportType = "general" | "bugs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectReportBrief[];
}

export function GenerateReportDialog({ open, onOpenChange, projects }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generatingFormat, setGeneratingFormat] = useState<Format | null>(null);
  const [reportType, setReportType] = useState<ReportType>("general");

  const toggleProject = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === projects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map((p) => p.product_id)));
    }
  };

  const handleGenerate = async (format: Format) => {
    if (selected.size === 0) {
      toast.error("Select at least one project");
      return;
    }
    setGeneratingFormat(format);
    try {
      const ids = Array.from(selected);
      const blob =
        format === "pdf"
          ? await reportsRepository.generatePDF(ids, reportType)
          : await reportsRepository.generateDocument(ids, reportType);

      const ext = format === "pdf" ? "pdf" : "docx";
      const prefix = reportType === "bugs" ? "Bug_Report" : "Project_Status_Update";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prefix}_${new Date().toISOString().split("T")[0]}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
      onOpenChange(false);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGeneratingFormat(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Generate Report
          </DialogTitle>
          <DialogDescription>
            Select report type and projects to include.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-1">
          <button
            type="button"
            onClick={() => setReportType("general")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              reportType === "general"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            General
          </button>
          <button
            type="button"
            onClick={() => setReportType("bugs")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              reportType === "bugs"
                ? "bg-red-600 text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            <Bug className="h-3.5 w-3.5" />
            Bugs
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            {selected.size === projects.length ? "Deselect All" : "Select All"}
          </button>
          <Badge variant="secondary" className="text-xs">
            {selected.size} / {projects.length} selected
          </Badge>
        </div>

        <ScrollArea className="max-h-[320px] -mx-1 px-1">
          <div className="space-y-1">
            {projects.map((p) => (
              <label
                key={p.product_id}
                className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <BaseCheckbox
                  checked={selected.has(p.product_id)}
                  onCheckedChange={() => toggleProject(p.product_id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.product_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.stage || "—"} · {p.completed_tasks}/{p.total_tasks} tasks
                  </p>
                </div>
                {selected.has(p.product_id) && (
                  <CheckCircle2 className="h-4 w-4 text-status-healthy flex-shrink-0" />
                )}
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <BaseButton variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </BaseButton>
          <BaseButton
            onClick={() => handleGenerate("docx")}
            disabled={generatingFormat !== null || selected.size === 0}
          >
            {generatingFormat === "docx" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            .docx
          </BaseButton>
          <BaseButton
            onClick={() => handleGenerate("pdf")}
            disabled={generatingFormat !== null || selected.size === 0}
          >
            {generatingFormat === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            .pdf
          </BaseButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
