"use client";

import { Badge } from "@/components/atoms/display/Badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/atoms/layout/Collapsible";
import { useScanHistory } from "@/hooks/queries/useScans";
import { History, ChevronDown, GitCommitHorizontal } from "lucide-react";
import { useState } from "react";

interface ScanHistoryListProps {
  productId: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  failed: "destructive",
  running: "secondary",
  pending: "outline",
};

function ScanHistoryList({ productId }: ScanHistoryListProps) {
  const { data } = useScanHistory(productId);
  const [expanded, setExpanded] = useState(false);

  const entries = data?.data ?? [];
  if (entries.length === 0) return null;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 pt-3 border-t cursor-pointer hover:bg-muted/50 rounded-md px-1 py-2 transition-colors"
        >
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Scan History</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {entries.length} {entries.length === 1 ? "scan" : "scans"}
          </Badge>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 pt-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-2 py-2 text-xs rounded-md hover:bg-muted/50"
            >
              <span className="text-muted-foreground tabular-nums shrink-0">
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1 font-mono text-muted-foreground shrink-0">
                <GitCommitHorizontal className="h-3 w-3" />
                {entry.latest_commit_sha.slice(0, 7)}
              </span>
              <span className="text-muted-foreground truncate">
                {entry.branch}
              </span>
              <Badge
                variant={STATUS_VARIANT[entry.scan_status] ?? "outline"}
                className="text-[10px] ml-auto shrink-0"
              >
                {entry.scan_status}
              </Badge>
              {entry.components_discovered && (
                <span className="text-muted-foreground/70 tabular-nums shrink-0">
                  {Object.values(entry.components_discovered).reduce((a, b) => a + b, 0)} artifacts
                </span>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { ScanHistoryList };
