"use client";

import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  Rocket,
  TrendingUp,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDashboardMetrics } from "@/hooks/queries/useDashboardMetrics";

interface QuickStatsProps {
  totalProducts?: number;
  inProgressCount?: number;
  healthyCount?: number;
  warningCount?: number;
  criticalCount?: number;
  deploymentStageCount?: number;
  filterProductIds?: Set<string>;
}


interface StatItemProps {
  label: string;
  value: number;
  suffix?: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  accent?: "success" | "warning" | "critical";
}

function StatItem({ label, value, suffix, Icon, iconColor, iconBg, accent }: StatItemProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden bg-card rounded-lg border p-3",
        "transition-all duration-200 ease-out hover:shadow-sm",
        accent === "warning" && "border-status-warning/30 hover:border-status-warning/50",
        accent === "critical" && "border-status-critical/30 hover:border-status-critical/50",
      )}
    >
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
            iconBg,
          )}
        >
          <Icon className={cn("h-4.5 w-4.5", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <p className="text-lg font-bold font-mono text-foreground tabular-nums">{value}</p>
            {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
          </div>
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function QuickStats(props: QuickStatsProps) {
  const { data: metrics, isLoading } = useDashboardMetrics();

  const stageDistribution = metrics?.stageDistribution ?? [];
  const totalProducts = props.totalProducts ?? stageDistribution.reduce((sum, s) => sum + s.count, 0);
  const deploymentStageCount = props.deploymentStageCount ?? (
    (stageDistribution.find((s) => s.stage === "Dev Ready")?.count ?? 0) +
    (stageDistribution.find((s) => s.stage === "Soft Launch")?.count ?? 0)
  );
  const healthyCount = props.healthyCount ?? (
    (stageDistribution.find((s) => s.stage === "Launched")?.count ?? 0) +
    (stageDistribution.find((s) => s.stage === "Live")?.count ?? 0)
  );
  const filter = props.filterProductIds;
  const overdueTasks = metrics?.overdueTasks ?? [];
  const failedQAChecks = metrics?.failedQAChecks ?? [];
  const warningCount = props.warningCount ?? (filter
    ? overdueTasks.filter((t) => filter.has(t.product_id)).length
    : overdueTasks.length);
  const criticalCount = props.criticalCount ?? (filter
    ? failedQAChecks.filter((q) => filter.has(q.product_id)).length
    : failedQAChecks.length);
  const inProgressCount = props.inProgressCount ?? (stageDistribution.find((s) => s.stage === "Development")?.count ?? 0);

  const hasAllProps = props.totalProducts !== undefined;
  if (isLoading && !hasAllProps) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatItem label="Total Projects" value={totalProducts} Icon={FolderKanban} iconColor="text-foreground" iconBg="bg-secondary" />
      <StatItem label="Healthy" value={healthyCount} Icon={CheckCircle2} iconColor="text-status-healthy" iconBg="bg-status-healthy/10" accent="success" />
      <StatItem label="Needs Attention" value={warningCount} Icon={Clock} iconColor="text-status-warning" iconBg="bg-status-warning/10" accent="warning" />
      <StatItem label="At Risk" value={criticalCount} Icon={AlertTriangle} iconColor="text-status-critical" iconBg="bg-status-critical/10" accent="critical" />
      <StatItem label="In Pipeline" value={deploymentStageCount} Icon={Rocket} iconColor="text-pillar-business" iconBg="bg-pillar-business/10" />
      <StatItem label="Health Rate" value={totalProducts > 0 ? Math.round((healthyCount / totalProducts) * 100) : 0} suffix="%" Icon={TrendingUp} iconColor="text-pillar-development" iconBg="bg-pillar-development/10" />
    </div>
  );
}
