"use client";

import { Badge } from "@/components/atoms/display/Badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/atoms/layout/Collapsible";
import type { TaskEvidence } from "@/lib/types";
import { CheckCircle2, XCircle, ChevronRight, FileCode } from "lucide-react";
import { useState } from "react";

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

export { ConfidenceBar, EvidenceRow };
