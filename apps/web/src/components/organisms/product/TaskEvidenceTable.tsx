"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/atoms/layout/Collapsible";
import { useScanResult } from "@/hooks/queries/useScans";
import type { TaskEvidence } from "@/lib/types";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  FileCode,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";

interface TaskEvidenceTableProps {
  productId: string;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? "bg-status-healthy" : pct >= 50 ? "bg-status-warning" : "bg-status-critical";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function EvidenceRow({ evidence }: { evidence: TaskEvidence }) {
  const [open, setOpen] = useState(false);
  const hasArtifacts = evidence.artifacts_found.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 rounded-md transition-colors group"
        >
          {evidence.verified ? (
            <CheckCircle2 className="h-4 w-4 text-status-healthy shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          )}
          <span className="flex-1 text-sm truncate">{evidence.task_title}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {evidence.status_in_pm}
          </Badge>
          <ConfidenceBar confidence={evidence.confidence} />
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 pl-3 border-l border-border space-y-2 pb-2">
          <p className="text-xs text-muted-foreground">{evidence.summary}</p>
          {hasArtifacts && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Evidence
              </span>
              {evidence.artifacts_found.map((artifact, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground"
                >
                  <FileCode className="h-3 w-3 shrink-0" />
                  <span className="truncate">{artifact}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TaskEvidenceTable({ productId }: TaskEvidenceTableProps) {
  const { data: scanResult, isLoading } = useScanResult(productId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Task Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const evidence = (scanResult?.functional_inventory ?? []) as TaskEvidence[];

  if (evidence.length === 0) {
    return null;
  }

  const verified = evidence.filter((e) => e.verified);
  const unverified = evidence.filter((e) => !e.verified);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Task Verification
          <Badge variant="secondary" className="ml-auto text-xs">
            {verified.length}/{evidence.length} verified
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {verified.map((e) => (
          <EvidenceRow key={e.task_id} evidence={e} />
        ))}
        {unverified.map((e) => (
          <EvidenceRow key={e.task_id} evidence={e} />
        ))}
      </CardContent>
    </Card>
  );
}

export { TaskEvidenceTable };
export type { TaskEvidenceTableProps };
