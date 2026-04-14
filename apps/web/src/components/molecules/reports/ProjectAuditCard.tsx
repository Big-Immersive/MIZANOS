"use client";

import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { useLatestAudit } from "@/hooks/queries/useAuditHistory";

interface Props {
  productId: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-status-healthy";
  if (score >= 60) return "text-amber-500";
  return "text-destructive";
}

export function ProjectAuditCard({ productId }: Props) {
  const { data: audit, isLoading } = useLatestAudit(productId);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" /> Latest Audit
        </h3>
        {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {!isLoading && !audit && (
          <p className="text-xs text-muted-foreground">No audits run for this project yet.</p>
        )}
        {audit && (
          <>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold tabular-nums ${scoreColor(audit.overall_score)}`}>
                {Math.round(audit.overall_score)}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Run {format(new Date(audit.run_at), "dd MMM yyyy, HH:mm")}
            </p>
            {audit.categories && typeof audit.categories === "object" && !Array.isArray(audit.categories) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {Object.entries(audit.categories as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{k}</span>
                    <span className={`font-mono font-medium ${scoreColor(Number(v))}`}>{Math.round(Number(v))}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
