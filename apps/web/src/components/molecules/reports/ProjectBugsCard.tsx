"use client";

import { Bug } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { useBugs } from "@/hooks/queries/useBugs";

interface Props {
  productId: string;
}

const BUG_STATUSES = ["reported", "triaging", "in_progress", "fixed", "verified", "reopened", "live"] as const;

export function ProjectBugsCard({ productId }: Props) {
  const { data: bugs = [], isLoading } = useBugs(productId);

  const counts: Record<string, number> = {};
  for (const b of bugs) {
    const key = b.status ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Bug className="h-4 w-4" /> Bugs
          <span className="text-xs text-muted-foreground">({bugs.length} total)</span>
        </h3>
        {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {!isLoading && bugs.length === 0 && (
          <p className="text-xs text-muted-foreground">No bugs reported.</p>
        )}
        {bugs.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {BUG_STATUSES.filter((s) => counts[s]).map((s) => (
                <div key={s} className="bg-secondary/50 rounded-lg py-2 text-center">
                  <p className="font-mono font-bold text-sm">{counts[s]}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{s.replace("_", " ")}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent</p>
              {bugs.slice(0, 8).map((b) => (
                <div key={b.id} className="text-xs border-l-2 border-border pl-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{b.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{(b.status ?? "unknown").replace("_", " ")}</Badge>
                  </div>
                  {b.description && (
                    <p className="text-muted-foreground line-clamp-2 mt-0.5">{b.description}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
