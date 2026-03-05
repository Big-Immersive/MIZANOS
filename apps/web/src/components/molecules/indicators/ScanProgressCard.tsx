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
import { useProgressSummary } from "@/hooks/queries/useScans";
import { useTriggerHighLevelScan, useCancelScan } from "@/hooks/mutations/useScanMutations";
import { useJob } from "@/hooks/queries/useJob";
import { ScanSearch, RefreshCw, GitCommitHorizontal, Clock, XCircle } from "lucide-react";
import { useState } from "react";

interface ScanProgressCardProps {
  productId: string;
}

function SegmentedBar({ summary }: { summary: { verified: number; partial: number; no_evidence: number; total_tasks: number } }) {
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
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-status-healthy" />
          Verified ({summary.verified})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-status-warning" />
          Partial ({summary.partial})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
          No evidence ({summary.no_evidence})
        </span>
      </div>
    </div>
  );
}

function ScanProgressCard({ productId }: ScanProgressCardProps) {
  const { data, isLoading } = useProgressSummary(productId);
  const triggerScan = useTriggerHighLevelScan(productId);
  const cancelScan = useCancelScan(productId);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { data: job } = useJob(jobId);

  const isScanning = triggerScan.isPending || (job?.status === "pending" || job?.status === "running");

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
            <ScanSearch className="h-4 w-4" /> Code Progress Scan
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

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanSearch className="h-4 w-4" /> Code Progress Scan
            </CardTitle>
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
              <SegmentedBar summary={summary} />
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
