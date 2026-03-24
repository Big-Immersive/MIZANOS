"use client";

import {
  FolderKanban,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useReportsSummary } from "@/hooks/queries/useReports";
import { Loader2 } from "lucide-react";

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  suffix?: string;
}

function StatCard({ icon, iconBg, label, value, suffix }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden bg-card rounded-lg border p-3">
      <div className="relative flex items-center gap-3">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold font-mono tabular-nums text-foreground">
            {value}{suffix ?? ""}
          </p>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function ReportsOverview() {
  const { data, isLoading } = useReportsSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={<FolderKanban className="h-4.5 w-4.5 text-primary" />}
        iconBg="bg-primary/10"
        label="Total Projects"
        value={data.total_projects}
      />
      <StatCard
        icon={<CheckCircle2 className="h-4.5 w-4.5 text-status-healthy" />}
        iconBg="bg-status-healthy/10"
        label="Tasks Completed"
        value={data.tasks_completed}
      />
      <StatCard
        icon={<Clock className="h-4.5 w-4.5 text-pillar-business" />}
        iconBg="bg-pillar-business/10"
        label="In Progress"
        value={data.tasks_in_progress}
      />
      <StatCard
        icon={<TrendingUp className="h-4.5 w-4.5 text-pillar-development" />}
        iconBg="bg-pillar-development/10"
        label="Completion Rate"
        value={data.overall_task_completion_pct}
        suffix="%"
      />
    </div>
  );
}
