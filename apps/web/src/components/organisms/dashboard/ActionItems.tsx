"use client";

import Link from "next/link";
import { Badge } from "@/components/atoms/display/Badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/atoms/display/Card";
import { ScrollArea } from "@/components/atoms/layout/ScrollArea";
import { cn } from "@/lib/utils/cn";
import {
  AlertTriangle,
  Clock,
  XCircle,
  ShieldAlert,
  Rocket,
  ChevronRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDashboardMetrics, type DashboardMetrics } from "@/hooks/queries/useDashboardMetrics";

interface ActionItem {
  id: string;
  taskId?: string;
  type: "overdue" | "due_soon" | "at_risk" | "low_audit" | "deployment";
  title: string;
  subtitle: string;
  productId: string;
  productName: string;
  severity: "critical" | "warning" | "info";
  meta?: string;
}

interface ActionItemsProps {
  metrics?: DashboardMetrics | undefined;
  filterProductIds?: Set<string>;
}

const iconMap: Record<ActionItem["type"], React.ReactNode> = {
  overdue: <Clock className="h-4 w-4" />,
  due_soon: <AlertTriangle className="h-4 w-4" />,
  at_risk: <XCircle className="h-4 w-4" />,
  low_audit: <ShieldAlert className="h-4 w-4" />,
  deployment: <Rocket className="h-4 w-4" />,
};

const severityStyles: Record<ActionItem["severity"], { icon: string; border: string; bg: string }> = {
  critical: {
    icon: "text-status-critical bg-status-critical/10",
    border: "border-status-critical/20 hover:border-status-critical/40",
    bg: "hover:bg-status-critical/5",
  },
  warning: {
    icon: "text-status-warning bg-status-warning/10",
    border: "border-status-warning/20 hover:border-status-warning/40",
    bg: "hover:bg-status-warning/5",
  },
  info: {
    icon: "text-muted-foreground bg-secondary",
    border: "border-border hover:border-border",
    bg: "hover:bg-accent/50",
  },
};

function buildActionItems(metrics: DashboardMetrics | undefined): ActionItem[] {
  if (!metrics) return [];
  const items: ActionItem[] = [];

  metrics.overdueTasks.forEach((t) =>
    items.push({
      id: `task-${t.id}`,
      taskId: t.id,
      type: "overdue",
      title: t.title,
      subtitle: `Due ${formatDistanceToNow(new Date(t.due_date), { addSuffix: true })}`,
      productId: t.product_id,
      productName: t.product_name,
      severity: "critical",
      meta: t.assignee_name || "Unassigned",
    }),
  );
  metrics.dueSoonTasks.forEach((t) =>
    items.push({
      id: `soon-${t.id}`,
      taskId: t.id,
      type: "due_soon",
      title: t.title,
      subtitle: `Due ${formatDistanceToNow(new Date(t.due_date), { addSuffix: true })}`,
      productId: t.product_id,
      productName: t.product_name,
      severity: "warning",
    }),
  );
  metrics.atRiskProjects.forEach((p) =>
    items.push({
      id: `risk-${p.product_id}`,
      type: "at_risk",
      title: p.product_name,
      subtitle: p.reason,
      productId: p.product_id,
      productName: p.product_name,
      severity: "critical",
    }),
  );
  metrics.lowScoreAudits.forEach((a) =>
    items.push({
      id: `audit-${a.product_id}`,
      type: "low_audit",
      title: `Audit Score: ${a.overall_score}%`,
      subtitle: `Run ${formatDistanceToNow(new Date(a.run_at), { addSuffix: true })}`,
      productId: a.product_id,
      productName: a.product_name,
      severity: a.overall_score < 50 ? "critical" : "warning",
    }),
  );
  metrics.incompleteDeployments.forEach((d) => {
    const progress = d.total_items > 0 ? Math.round((d.completed_items / d.total_items) * 100) : 0;
    items.push({
      id: `deploy-${d.product_id}`,
      type: "deployment",
      title: `Deployment ${progress}% Complete`,
      subtitle: `${d.completed_items}/${d.total_items} items checked`,
      productId: d.product_id,
      productName: d.product_name,
      severity: progress < 50 ? "warning" : "info",
    });
  });

  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);
  return items;
}

export function ActionItems({ metrics: metricsProp, filterProductIds }: ActionItemsProps) {
  const { data: fetchedMetrics, isLoading, isRefetching, refetch } = useDashboardMetrics();
  const metrics = metricsProp ?? fetchedMetrics;
  const allItems = buildActionItems(metrics);
  const actionItems = filterProductIds
    ? allItems.filter((i) => filterProductIds.has(i.productId))
    : allItems;
  const criticalCount = actionItems.filter((i) => i.severity === "critical").length;
  const warningCount = actionItems.filter((i) => i.severity === "warning").length;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Action Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Loading action items...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (actionItems.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Action Required
            </CardTitle>
            <button type="button" onClick={() => refetch()} disabled={isRefetching} className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isRefetching && "animate-spin")} />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-10 w-10 rounded-full bg-status-healthy/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-5 w-5 text-status-healthy" />
            </div>
            <p className="text-sm font-medium text-foreground">All clear!</p>
            <p className="text-xs text-muted-foreground mt-0.5">No action items at the moment</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full transition-colors duration-300", criticalCount > 0 && "border-status-critical/30")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center", criticalCount > 0 ? "bg-status-critical/10" : "bg-status-warning/10")}>
              <AlertTriangle className={cn("h-3.5 w-3.5", criticalCount > 0 ? "text-status-critical" : "text-status-warning")} />
            </div>
            Action Required
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && <Badge variant="destructive" className="text-xs">{criticalCount} Critical</Badge>}
            {warningCount > 0 && <Badge variant="outline" className="text-xs border-status-warning/50 text-status-warning">{warningCount} Warning</Badge>}
            <button type="button" onClick={() => refetch()} disabled={isRefetching} className="p-1.5 rounded-md hover:bg-accent transition-colors ml-1">
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isRefetching && "animate-spin")} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-2">
          <div className="space-y-1.5">
            {actionItems.slice(0, 12).map((item, index) => {
              const styles = severityStyles[item.severity];
              return (
                <Link
                  key={item.id}
                  href={item.taskId ? `/projects/${item.productId}?tab=tasks&task=${item.taskId}` : `/projects/${item.productId}`}
                  className={cn("block p-2.5 rounded-lg border transition-all duration-200 group", styles.border, styles.bg)}
                  style={{ opacity: 0, animation: `fade-in 0.2s ease-out ${index * 50}ms forwards` }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn("h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0", styles.icon)}>
                      {iconMap[item.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-medium">{item.productName}</span>
                        <span className="mx-1">&bull;</span>
                        <span>{item.subtitle}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
