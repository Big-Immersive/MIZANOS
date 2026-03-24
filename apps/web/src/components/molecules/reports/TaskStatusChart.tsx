"use client";

import { Card, CardContent } from "@/components/atoms/display/Card";
import type { TaskMetrics } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-status-healthy",
  completed: "bg-status-healthy",
  verified: "bg-status-healthy",
  live: "bg-status-healthy",
  in_progress: "bg-pillar-development",
  in_review: "bg-pillar-product",
  review: "bg-pillar-product",
  backlog: "bg-secondary",
  todo: "bg-muted-foreground/30",
};

const STATUS_LABELS: Record<string, string> = {
  done: "Done",
  completed: "Completed",
  verified: "Verified",
  live: "Live",
  in_progress: "In Progress",
  in_review: "In Review",
  review: "Review",
  backlog: "Backlog",
  todo: "To Do",
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-muted-foreground/20";
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

interface Props {
  metrics: TaskMetrics;
}

export function TaskStatusChart({ metrics }: Props) {
  const entries = Object.entries(metrics.by_status).sort(
    ([, a], [, b]) => b - a,
  );
  const total = metrics.total || 1;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tasks</h3>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {metrics.completion_pct}% complete
          </span>
        </div>

        {/* Stacked bar */}
        <div className="h-4 rounded-full overflow-hidden flex bg-secondary">
          {entries.map(([status, count]) => (
            <div
              key={status}
              className={`h-full ${statusColor(status)} transition-all`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${statusLabel(status)}: ${count}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {entries.map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 text-xs">
              <div className={`h-2.5 w-2.5 rounded-sm flex-shrink-0 ${statusColor(status)}`} />
              <span className="text-muted-foreground capitalize">
                {statusLabel(status)}
              </span>
              <span className="font-mono tabular-nums ml-auto">{count}</span>
            </div>
          ))}
        </div>

        {/* Priority + overdue */}
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground border-t">
          {Object.entries(metrics.by_priority).map(([p, c]) => (
            <span key={p} className="capitalize">
              {p}: <span className="font-mono font-medium text-foreground">{c}</span>
            </span>
          ))}
          {metrics.overdue_count > 0 && (
            <span className="text-status-critical ml-auto">
              {metrics.overdue_count} overdue
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
