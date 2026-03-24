"use client";

import Link from "next/link";
import { BarChart3, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/atoms/display/Card";
import { useReportsSummary } from "@/hooks/queries/useReports";

export function ReportsSummaryCard() {
  const { data, isLoading } = useReportsSummary();

  if (isLoading) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const topProjects = [...data.projects]
    .sort((a, b) => b.task_completion_pct - a.task_completion_pct)
    .slice(0, 5);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Project Reports
          </CardTitle>
          <Link
            href="/reports"
            className="text-xs font-medium text-primary hover:underline"
          >
            View All
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aggregate stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatPill
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-status-healthy" />}
            label="Completed"
            value={data.tasks_completed}
            total={data.total_tasks}
          />
          <StatPill
            icon={<Clock className="h-3.5 w-3.5 text-pillar-business" />}
            label="In Progress"
            value={data.tasks_in_progress}
            total={data.total_tasks}
          />
          <StatPill
            icon={<BarChart3 className="h-3.5 w-3.5 text-primary" />}
            label="Completion"
            value={data.overall_task_completion_pct}
            suffix="%"
          />
        </div>

        {/* Overall progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Overall Progress</span>
            <span className="font-mono">{data.overall_task_completion_pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${data.overall_task_completion_pct}%` }}
            />
          </div>
        </div>

        {/* Top projects */}
        <div className="space-y-2">
          {topProjects.map((p) => (
            <Link
              key={p.product_id}
              href={`/reports/${p.product_id}`}
              className="flex items-center justify-between text-sm hover:bg-accent/50 rounded px-2 py-1.5 -mx-2 transition-colors"
            >
              <span className="truncate min-w-0 flex-1 font-medium">
                {p.product_name}
              </span>
              <span className="font-mono text-xs text-muted-foreground ml-2">
                {p.completed_tasks}/{p.total_tasks}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon,
  label,
  value,
  total,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
      {icon}
      <div className="min-w-0">
        <p className="text-sm font-bold font-mono tabular-nums">
          {value}{suffix ?? ""}{total != null ? `/${total}` : ""}
        </p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
