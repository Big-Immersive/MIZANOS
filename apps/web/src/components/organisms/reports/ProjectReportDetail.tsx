"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Calendar, GitBranch, User, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { useProjectReport } from "@/hooks/queries/useReports";
import { useProductDetail } from "@/hooks/queries/useProductDetail";
import { TaskStatusChart } from "@/components/molecules/reports/TaskStatusChart";
import { AIAnalysisCard } from "@/components/molecules/reports/AIAnalysisCard";
import { ProjectMembersCard } from "@/components/molecules/reports/ProjectMembersCard";
import { ProjectStageProgressCard } from "@/components/molecules/reports/ProjectStageProgressCard";
import { ProjectTimelineHealthCard } from "@/components/molecules/reports/ProjectTimelineHealthCard";
import { ProjectAuditCard } from "@/components/molecules/reports/ProjectAuditCard";
import { ProjectBugsCard } from "@/components/molecules/reports/ProjectBugsCard";
import { ProjectTasksListCard } from "@/components/molecules/reports/ProjectTasksListCard";

interface Props {
  productId: string;
}

export function ProjectReportDetail({ productId }: Props) {
  const { data, isLoading } = useProjectReport(productId);
  const { data: productDetail } = useProductDetail(productId);
  const product = productDetail?.product;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const gm = data.github_metrics;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="animate-fade-in">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/projects/${productId}`}
              className="text-xl font-semibold hover:text-primary hover:underline transition-colors"
            >
              {data.product_name}
            </Link>
            {data.stage && (
              <Badge variant="secondary" className="text-xs">
                {data.stage}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            {data.pm_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> PM: {data.pm_name}
              </span>
            )}
            {data.dev_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Dev: {data.dev_name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Created {format(new Date(data.created_at), "dd MMM yyyy")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          <TaskStatusChart metrics={data.task_metrics} productId={productId} />
        </div>

        <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-semibold">Code Progress</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-pillar-product transition-all"
                    style={{ width: `${data.feature_metrics.completion_pct}%` }}
                  />
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {data.feature_metrics.completion_pct}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {Object.entries(data.feature_metrics.by_status).map(([s, c]) => (
                  <div key={s} className="bg-secondary/50 rounded-lg py-2">
                    <p className="font-mono font-bold text-sm">{c}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{s}</p>
                  </div>
                ))}
              </div>

              {gm && (
                <>
                  <h3 className="text-sm font-semibold pt-2 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" /> GitHub
                    {gm.branch && (
                      <span className="text-[10px] font-normal text-muted-foreground">({gm.branch})</span>
                    )}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="Total Commits" value={gm.total_commits} />
                    <MiniStat label="Today" value={gm.today_commits} color="text-status-healthy" />
                    <MiniStat label="Contributors" value={gm.contributors_count} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline + Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
          <ProjectTimelineHealthCard
            startDate={product?.start_date ?? null}
            endDate={product?.end_date ?? null}
            completionPct={data.task_metrics.completion_pct ?? 0}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          <ProjectStageProgressCard stage={product?.stage ?? data.stage ?? null} />
        </div>
      </div>

      {/* Members + Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
          <ProjectMembersCard productId={productId} />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
          <ProjectAuditCard productId={productId} />
        </div>
      </div>

      {/* Tasks + Bugs detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: "350ms" }}>
          <ProjectTasksListCard productId={productId} />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "400ms" }}>
          <ProjectBugsCard productId={productId} />
        </div>
      </div>

      {/* AI Analysis (Development Health) */}
      <div className="animate-fade-in" style={{ animationDelay: "450ms" }}>
        <AIAnalysisCard productId={productId} analysis={data.ai_analysis} />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-secondary/50 rounded-lg py-2">
      <p className={`font-mono font-bold text-sm ${color ?? ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
