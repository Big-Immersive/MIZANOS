"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  Rocket,
  TrendingUp,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDashboardMetrics, type DashboardMetrics } from "@/hooks/queries/useDashboardMetrics";

interface QuickStatsProps {
  totalProducts?: number;
  inProgressCount?: number;
  healthyCount?: number;
  warningCount?: number;
  criticalCount?: number;
  deploymentStageCount?: number;
  filterProductIds?: Set<string>;
}

type StatType = "total" | "healthy" | "attention" | "risk" | "pipeline" | "health";

interface StatItemProps {
  label: string;
  value: number;
  suffix?: string;
  description: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  accent?: "success" | "warning" | "critical";
  onClick?: () => void;
  clickable?: boolean;
}

function StatItem({ label, value, suffix, description, Icon, iconColor, iconBg, accent, onClick, clickable }: StatItemProps) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={cn(
        "group relative overflow-hidden bg-card rounded-lg border p-3",
        "transition-all duration-200 ease-out hover:shadow-sm",
        clickable && "cursor-pointer hover:bg-accent/50",
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
      <p className="mt-1.5 text-[10px] text-muted-foreground/70 truncate">{description}</p>
    </div>
  );
}

interface DetailsModalProps {
  type: StatType;
  metrics: DashboardMetrics;
  stageDistribution: Array<{ stage: string; count: number }>;
  onClose: () => void;
}

function DetailsModal({ type, metrics, stageDistribution, onClose }: DetailsModalProps) {
  const getTitle = () => {
    switch (type) {
      case "total": return "All Projects by Stage";
      case "healthy": return "Healthy Projects";
      case "attention": return "Tasks Needing Attention";
      case "risk": return "Projects At Risk";
      case "pipeline": return "Projects In Pipeline";
      case "health": return "Health Rate Breakdown";
      default: return "Details";
    }
  };

  const getContent = () => {
    switch (type) {
      case "total":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Distribution of all projects across stages:</p>
            {stageDistribution.map((s) => (
              <div key={s.stage} className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-sm">{s.stage}</span>
                <span className="text-sm font-mono font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        );

      case "healthy":
        const healthyStages = stageDistribution.filter(s => s.stage === "Launched" || s.stage === "Live");
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Projects in Launched or Live stage:</p>
            {healthyStages.length > 0 ? healthyStages.map((s) => (
              <div key={s.stage} className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-healthy" />
                  {s.stage}
                </span>
                <span className="text-sm font-mono font-medium">{s.count}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">No projects in Launched or Live stage yet.</p>
            )}
          </div>
        );

      case "attention":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Tasks that are overdue and need attention:</p>
            {metrics.overdueTasks.length > 0 ? metrics.overdueTasks.map((t) => (
              <div key={t.id} className="py-2 border-b border-border/50">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{t.title}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded",
                    t.priority === "high" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  )}>{t.priority}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{t.product_name}</span>
                  <span className="text-xs text-status-warning">Due: {new Date(t.due_date).toLocaleDateString()}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">No overdue tasks. Great job!</p>
            )}
          </div>
        );

      case "risk":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Projects with low audit scores (&lt;60%) or 3+ overdue tasks:</p>
            {metrics.atRiskProjects.length > 0 ? metrics.atRiskProjects.map((p) => (
              <div key={p.product_id} className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-status-critical" />
                  {p.product_name}
                </span>
                <span className="text-xs text-status-critical">{p.reason}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">No projects at risk. Everything looks good!</p>
            )}
          </div>
        );

      case "pipeline":
        const pipelineStages = stageDistribution.filter(s => s.stage === "Dev Ready" || s.stage === "Soft Launch");
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Projects ready for deployment (Dev Ready or Soft Launch):</p>
            {pipelineStages.length > 0 ? pipelineStages.map((s) => (
              <div key={s.stage} className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-sm flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-pillar-business" />
                  {s.stage}
                </span>
                <span className="text-sm font-mono font-medium">{s.count}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">No projects in deployment pipeline yet.</p>
            )}
          </div>
        );

      case "health":
        const total = stageDistribution.reduce((sum, s) => sum + s.count, 0);
        const healthyStagesForRate = stageDistribution.filter(s => s.stage === "Launched" || s.stage === "Live");
        const healthy = healthyStagesForRate.reduce((sum, s) => sum + s.count, 0);
        const notHealthy = total - healthy;
        const rate = total > 0 ? Math.round((healthy / total) * 100) : 0;
        const otherStages = stageDistribution.filter(s => s.stage !== "Launched" && s.stage !== "Live");
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Percentage of projects that are live and healthy:</p>
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="text-center">
                <span className="text-3xl font-bold font-mono">{rate}%</span>
                <p className="text-sm text-muted-foreground mt-1">{healthy} healthy out of {total} total</p>
              </div>
              <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-healthy rounded-full transition-all"
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>

            {/* Healthy Projects Breakdown */}
            <div>
              <p className="text-xs font-medium text-status-healthy mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Healthy Projects ({healthy})
              </p>
              {healthyStagesForRate.length > 0 ? (
                <div className="space-y-1 pl-4">
                  {healthyStagesForRate.map((s) => (
                    <div key={s.stage} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{s.stage}</span>
                      <span className="font-mono">{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pl-4 italic">No projects in Launched or Live stage</p>
              )}
            </div>

            {/* Not Yet Healthy Breakdown */}
            <div>
              <p className="text-xs font-medium text-status-warning mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Not Yet Healthy ({notHealthy})
              </p>
              {otherStages.length > 0 ? (
                <div className="space-y-1 pl-4">
                  {otherStages.map((s) => (
                    <div key={s.stage} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{s.stage}</span>
                      <span className="font-mono">{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pl-4 italic">All projects are healthy!</p>
              )}
            </div>

            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Health rate = (Launched + Live) ÷ Total × 100
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                To improve: Move projects from Development/QA to Launched or Live stage.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{getTitle()}</h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {getContent()}
        </div>
      </div>
    </div>
  );
}

export function QuickStats(props: QuickStatsProps) {
  const { data: metrics, isLoading } = useDashboardMetrics();
  const [activeModal, setActiveModal] = useState<StatType | null>(null);

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
  const atRiskProjects = metrics?.atRiskProjects ?? [];
  const warningCount = props.warningCount ?? (filter
    ? overdueTasks.filter((t) => filter.has(t.product_id)).length
    : overdueTasks.length);
  const criticalCount = props.criticalCount ?? (filter
    ? atRiskProjects.filter((p) => filter.has(p.product_id)).length
    : atRiskProjects.length);

  const hasAllProps = props.totalProducts !== undefined;
  if (isLoading && !hasAllProps) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatItem
          label="Total Projects"
          value={totalProducts}
          description="All projects across all stages"
          Icon={FolderKanban}
          iconColor="text-foreground"
          iconBg="bg-secondary"
          onClick={() => setActiveModal("total")}
          clickable
        />
        <StatItem
          label="Healthy"
          value={healthyCount}
          description="Launched or Live projects"
          Icon={CheckCircle2}
          iconColor="text-status-healthy"
          iconBg="bg-status-healthy/10"
          accent="success"
          onClick={() => setActiveModal("healthy")}
          clickable
        />
        <StatItem
          label="Needs Attention"
          value={warningCount}
          description="Tasks past their due date"
          Icon={Clock}
          iconColor="text-status-warning"
          iconBg="bg-status-warning/10"
          accent="warning"
          onClick={() => setActiveModal("attention")}
          clickable
        />
        <StatItem
          label="At Risk"
          value={criticalCount}
          description="Low audit score or 3+ overdue"
          Icon={AlertTriangle}
          iconColor="text-status-critical"
          iconBg="bg-status-critical/10"
          accent="critical"
          onClick={() => setActiveModal("risk")}
          clickable
        />
        <StatItem
          label="In Pipeline"
          value={deploymentStageCount}
          description="Dev Ready or Soft Launch"
          Icon={Rocket}
          iconColor="text-pillar-business"
          iconBg="bg-pillar-business/10"
          onClick={() => setActiveModal("pipeline")}
          clickable
        />
        <StatItem
          label="Health Rate"
          value={totalProducts > 0 ? Math.round((healthyCount / totalProducts) * 100) : 0}
          suffix="%"
          description="% of projects live/launched"
          Icon={TrendingUp}
          iconColor="text-pillar-development"
          iconBg="bg-pillar-development/10"
          onClick={() => setActiveModal("health")}
          clickable
        />
      </div>

      {activeModal && metrics && (
        <DetailsModal
          type={activeModal}
          metrics={metrics}
          stageDistribution={stageDistribution}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}
