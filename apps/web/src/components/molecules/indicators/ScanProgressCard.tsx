"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/atoms/feedback/Tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/layout/Dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/atoms/layout/Collapsible";
import { EvidenceRow } from "./EvidenceRow";
import { ScanHistoryList } from "./ScanHistoryList";
import { useProgressSummary, useScanResult } from "@/hooks/queries/useScans";
import { useTriggerHighLevelScan, useCancelScan } from "@/hooks/mutations/useScanMutations";
import { useJob } from "@/hooks/queries/useJob";
import { useQueryClient } from "@tanstack/react-query";
import type { TaskEvidence } from "@/lib/types";
import { ScanSearch, RefreshCw, GitCommitHorizontal, Clock, XCircle, ChevronDown, ClipboardList } from "lucide-react";
import { useState, useEffect } from "react";

interface ScanProgressCardProps {
  productId: string;
}

function SegmentedBar({ summary, onFilterClick }: { summary: { verified: number; partial: number; no_evidence: number; total_tasks: number }; onFilterClick?: (filter: "verified" | "partial" | "no_evidence") => void }) {
  const total = summary.total_tasks || 1;
  const verifiedPct = (summary.verified / total) * 100;
  const partialPct = (summary.partial / total) * 100;
  const noEvidencePct = (summary.no_evidence / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
        {verifiedPct > 0 && (
          <div className="bg-status-healthy transition-all" style={{ width: `${verifiedPct}%` }} />
        )}
        {partialPct > 0 && (
          <div className="bg-status-warning transition-all" style={{ width: `${partialPct}%` }} />
        )}
        {noEvidencePct > 0 && (
          <div className="bg-muted-foreground/20 transition-all" style={{ width: `${noEvidencePct}%` }} />
        )}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <button onClick={() => onFilterClick?.("verified")} className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
          <span className="inline-block h-2 w-2 rounded-full bg-status-healthy" />
          Verified ({summary.verified})
        </button>
        <button onClick={() => onFilterClick?.("partial")} className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
          <span className="inline-block h-2 w-2 rounded-full bg-status-warning" />
          Partial ({summary.partial})
        </button>
        <button onClick={() => onFilterClick?.("no_evidence")} className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
          No evidence ({summary.no_evidence})
        </button>
      </div>
    </div>
  );
}

function ScanProgressCard({ productId }: ScanProgressCardProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useProgressSummary(productId);
  const { data: scanResult } = useScanResult(productId);
  const triggerScan = useTriggerHighLevelScan(productId);
  const cancelScan = useCancelScan(productId);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | "verified" | "partial" | "no_evidence">("all");

  // Pick up active job from summary (e.g. page reload while scan runs)
  const activeJobId = jobId ?? data?.active_job_id ?? null;
  const { data: job } = useJob(activeJobId);

  const jobStatus = job?.status;
  const isScanning = triggerScan.isPending || jobStatus === "pending" || jobStatus === "running";

  // When job finishes, refresh the progress summary automatically
  useEffect(() => {
    if (!activeJobId || !jobStatus) return;
    const isDone = jobStatus === "completed" || jobStatus === "failed";
    if (isDone) {
      queryClient.invalidateQueries({ queryKey: ["scans", productId] });
      setJobId(null);
    }
  }, [activeJobId, jobStatus, productId, queryClient]);

  const handleScan = () => {
    triggerScan.mutate(undefined, {
      onSuccess: (newJob) => setJobId(newJob.id),
    });
  };

  const handleCancelConfirm = () => {
    cancelScan.mutate(undefined, {
      onSuccess: () => {
        setJobId(null);
        setShowCancelDialog(false);
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScanSearch className="h-4 w-4" /> Code Evidence Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  const summary = data?.scan_summary as { verified: number; partial: number; no_evidence: number; total_tasks: number } | null;
  const progressPct = data?.progress_pct ?? 0;
  const evidence = (scanResult?.functional_inventory ?? []) as TaskEvidence[];
  const verifiedEvidence = evidence.filter((e) => e.verified && e.confidence >= 0.7);
  const partialEvidence = evidence.filter((e) => e.verified && e.confidence < 0.7 || (!e.verified && e.confidence >= 0.4));
  const noEvidenceList = evidence.filter((e) => !e.verified && e.confidence < 0.4);
  const filteredEvidence = evidenceFilter === "all" ? evidence
    : evidenceFilter === "verified" ? verifiedEvidence
    : evidenceFilter === "partial" ? partialEvidence
    : noEvidenceList;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ScanSearch className="h-4 w-4" /> Code Evidence Scan
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                How well each done task is backed by real code — separate from task-completion %.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isScanning && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancelDialog(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleScan}
                disabled={isScanning}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isScanning ? "animate-spin" : ""}`} />
                {isScanning ? "Scanning..." : "Scan Now"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isScanning && job && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{job.progress_message ?? "Working..."}</span>
                <span className="tabular-nums">{job.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          {summary && summary.total_tasks > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold tabular-nums">
                  {Math.round(progressPct)}%
                </span>
                <Badge
                  variant={progressPct >= 80 ? "default" : progressPct >= 40 ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {summary.verified} of {summary.total_tasks} verified
                </Badge>
              </div>
              <SegmentedBar summary={summary} onFilterClick={(f) => { setEvidenceFilter(f); setEvidenceExpanded(true); }} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {data?.last_scan_at
                ? "No tasks found during last scan."
                : "No scans yet. Click 'Scan Now' to analyze code progress."}
            </p>
          )}

          {data?.last_scan_at && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-default">
                      <Clock className="h-3 w-3" />
                      {new Date(data.last_scan_at).toLocaleString()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Last scan time</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {data.commit_sha && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-default font-mono">
                        <GitCommitHorizontal className="h-3 w-3" />
                        {data.commit_sha.slice(0, 7)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Scanned branch</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}

          {evidence.length > 0 && (
            <Collapsible open={evidenceExpanded} onOpenChange={setEvidenceExpanded}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 pt-3 border-t cursor-pointer hover:bg-muted/50 rounded-md px-1 py-2 transition-colors"
                >
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Task Verification</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {verifiedEvidence.length}/{evidence.length} verified
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${evidenceExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex gap-1 pt-2 pb-1">
                  {([
                    { key: "all", label: "All", count: evidence.length },
                    { key: "verified", label: "Verified", count: verifiedEvidence.length },
                    { key: "partial", label: "Partial", count: partialEvidence.length },
                    { key: "no_evidence", label: "No Evidence", count: noEvidenceList.length },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setEvidenceFilter(tab.key)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        evidenceFilter === tab.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
                <div className="space-y-0.5 pt-1 max-h-[400px] overflow-y-auto">
                  {filteredEvidence.length > 0 ? (
                    filteredEvidence.map((e) => (
                      <EvidenceRow key={e.task_id} evidence={e} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No tasks in this category
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <ScanHistoryList productId={productId} />
        </CardContent>
      </Card>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Scan</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the running scan? This will stop the scan and mark it as failed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Running
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelScan.isPending}
            >
              {cancelScan.isPending ? "Cancelling..." : "Cancel Scan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { ScanProgressCard };
export type { ScanProgressCardProps };
