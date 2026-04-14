"use client";

import { CalendarRange, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";

interface Props {
  startDate: string | null;
  endDate: string | null;
  completionPct: number;
}

type HealthStatus = "ready" | "needs_attention" | "on_track" | "no_timeline" | "overdue";

function dayDiff(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function evaluate(endDate: string | null, completionPct: number): HealthStatus {
  if (!endDate) return "no_timeline";
  const [y, m, d] = endDate.slice(0, 10).split("-").map(Number);
  const end = new Date(y, (m ?? 1) - 1, d ?? 1);
  const days = dayDiff(end);
  if (days < 0 && completionPct < 100) return "overdue";
  if (days <= 7 && completionPct >= 90) return "ready";
  if (days <= 7 && completionPct < 70) return "needs_attention";
  return "on_track";
}

const STATUS_META: Record<HealthStatus, { label: string; color: string; icon: typeof CheckCircle2; msg: string }> = {
  ready: { label: "Ready", color: "text-status-healthy", icon: CheckCircle2, msg: "End date is near and most tasks are complete. Project is on track to finish on time." },
  needs_attention: { label: "Needs Attention", color: "text-destructive", icon: AlertTriangle, msg: "End date is approaching but task completion is behind. Project needs immediate attention." },
  on_track: { label: "On Track", color: "text-primary", icon: Clock, msg: "Project is progressing within its timeline." },
  overdue: { label: "Overdue", color: "text-destructive", icon: AlertTriangle, msg: "End date has passed and the project is not yet complete." },
  no_timeline: { label: "No Timeline", color: "text-muted-foreground", icon: Clock, msg: "Set a start and end date to enable timeline health evaluation." },
};

export function ProjectTimelineHealthCard({ startDate, endDate, completionPct }: Props) {
  const status = evaluate(endDate, completionPct);
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <CalendarRange className="h-4 w-4" /> Timeline Health
        </h3>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${meta.color}`} />
          <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">{completionPct}% complete</span>
        </div>
        <p className="text-xs text-muted-foreground">{meta.msg}</p>
        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div>
            <p className="text-muted-foreground">Start</p>
            <p className="font-medium">{startDate ? format(new Date(startDate), "dd MMM yyyy") : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">End</p>
            <p className="font-medium">{endDate ? format(new Date(endDate), "dd MMM yyyy") : "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
