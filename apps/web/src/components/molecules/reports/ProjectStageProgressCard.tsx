"use client";

import { CheckCircle2, Circle, Workflow } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { PRODUCT_STAGES } from "@/lib/constants";

const TRACK = ["Intake", "Development", "QA", "Security", "Dev Ready", "Soft Launch", "Launched"] as const;

interface Props {
  stage: string | null;
}

export function ProjectStageProgressCard({ stage }: Props) {
  const currentIndex = stage ? TRACK.indexOf(stage as (typeof TRACK)[number]) : -1;
  const isOnHold = stage === "On Hold";

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Workflow className="h-4 w-4" /> Stage Progress
        </h3>
        {isOnHold ? (
          <p className="text-sm text-amber-600">Project is currently On Hold.</p>
        ) : (
          <ol className="space-y-2">
            {TRACK.map((s, i) => {
              const done = currentIndex >= 0 && i < currentIndex;
              const current = i === currentIndex;
              return (
                <li key={s} className="flex items-center gap-2 text-sm">
                  {done || current ? (
                    <CheckCircle2 className={`h-4 w-4 ${current ? "text-primary" : "text-status-healthy"}`} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={current ? "font-medium" : done ? "" : "text-muted-foreground"}>{s}</span>
                  {current && <span className="text-[10px] text-primary">(current)</span>}
                </li>
              );
            })}
          </ol>
        )}
        {stage && !TRACK.includes(stage as (typeof TRACK)[number]) && !isOnHold && (
          <p className="text-xs text-muted-foreground">Custom stage: {stage}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Tracked stages: {PRODUCT_STAGES.length}
        </p>
      </CardContent>
    </Card>
  );
}
