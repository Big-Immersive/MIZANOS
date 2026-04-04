"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { PillarBadge } from "@/components/molecules/indicators/PillarBadge";
import { StatsGrid } from "@/components/molecules/indicators/StatsGrid";
import { StageProgress } from "./StageProgress";
import { useProductDetail } from "@/hooks/queries/useProductDetail";
import { useTasks } from "@/hooks/queries/useTasks";
import { useLatestSpecification } from "@/hooks/queries/useSpecifications";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import type { ProductMember } from "@/lib/types";
import { StakeholdersList } from "./StakeholdersList";
import { ManagementNotes } from "./ManagementNotes";
import { PartnerNotes } from "./PartnerNotes";
import { DevelopmentHealthSection } from "./DevelopmentHealthSection";
import { ExternalDocumentsOverview } from "./ExternalDocumentsOverview";
import { ScanProgressCard } from "@/components/molecules/indicators/ScanProgressCard";
import type { ProductStage } from "@/lib/constants";
import { FileText, Users } from "lucide-react";

interface ProductOverviewProps {
  productId: string;
}

function TeamCard({ members }: { members: ProductMember[] }) {
  if (members.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground truncate mr-2">
              {member.profile?.full_name ?? member.profile?.email ?? "Unknown"}
            </span>
            <Badge variant="outline" className="text-[10px] shrink-0">{member.role ?? "Member"}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function deriveStage(tasks: { status?: string | null }[]): ProductStage | null {
  if (tasks.length === 0) return null;
  const allDoneOrLive = tasks.every((t) => t.status === "done" || t.status === "live");
  if (allDoneOrLive) return "Launched";
  const allReviewOrLater = tasks.every((t) => t.status === "review" || t.status === "done" || t.status === "live");
  if (allReviewOrLater) return "QA";
  const noneInBacklog = tasks.every((t) => t.status !== "backlog");
  if (noneInBacklog) return "Development";
  return null;
}

function ProductOverview({ productId }: ProductOverviewProps) {
  const { user } = useAuth();
  const { canViewManagementNotes, canViewPartnerNotes, canManageStakeholders, isProjectManager, isSuperAdmin } =
    useRoleVisibility();
  const { data, isLoading } = useProductDetail(productId);
  const { data: tasks } = useTasks(productId);
  const { data: specification } = useLatestSpecification(productId);

  if (isLoading || !data?.product) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { product, members } = data;
  const totalTasks = tasks?.length ?? 0;
  const tasksCompleted =
    tasks?.filter((t) => t.status === "done" || t.status === "live").length ?? 0;
  const blockers =
    tasks?.filter((t) => (t.priority === "critical" || t.priority === "high") && t.status === "backlog").length ?? 0;

  // Weighted progress: backlog=0, in_progress=0.3, review=0.6, done=1, live=1
  const STATUS_WEIGHT: Record<string, number> = {
    backlog: 0, in_progress: 0.3, review: 0.6, done: 1, live: 1,
  };
  const progress = totalTasks > 0
    ? Math.round((tasks!.reduce((sum, t) => sum + (STATUS_WEIGHT[t.status ?? "backlog"] ?? 0), 0) / totalTasks) * 100)
    : 0;

  // Health score (0-100): penalize blockers & overdue, reward progress
  const overdueTasks = tasks?.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done" && t.status !== "live",
  ).length ?? 0;
  const healthScore = totalTasks > 0
    ? Math.max(0, Math.min(100, Math.round(progress - (blockers * 15) - (overdueTasks * 10))))
    : 0;

  const specContent = specification?.content as Record<string, unknown> | null;
  const overview = specContent?.overview as string | undefined;

  return (
    <div className="space-y-6">
      {overview ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {overview}
            </p>
          </CardContent>
        </Card>
      ) : !specification ? (
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="py-8 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No project data uploaded yet. Upload documents or notes in the
              Intake stage to generate the project overview.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <StatsGrid
        healthScore={healthScore}
        progress={progress}
        tasksCompleted={tasksCompleted}
        totalTasks={totalTasks}
        blockers={blockers}
      />

      {product.repository_url && (
        <ScanProgressCard productId={productId} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Stage</span>
              <span className="font-medium">{product.stage ?? "N/A"}</span>
            </div>
            {product.pillar && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Pillar</span>
                <PillarBadge pillar={product.pillar} />
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created By</span>
              <span className="font-medium">
                {product.created_by_name ?? "Unknown"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span className="tabular-nums text-xs">
                {new Date(product.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="tabular-nums text-xs">
                {new Date(product.updated_at).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <StageProgress
          currentStage={product.stage ?? "Intake"}
          productId={productId}
          suggestedStage={tasks ? deriveStage(tasks) : null}
          canChangeStage={isProjectManager || isSuperAdmin}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TeamCard members={members} />
        <ExternalDocumentsOverview productId={productId} />
      </div>

      {canManageStakeholders && <StakeholdersList productId={productId} />}

      {(canViewManagementNotes || canViewPartnerNotes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {canViewManagementNotes && (
            <ManagementNotes
              productId={productId}
              authorId={user?.profile_id ?? user?.id ?? ""}
            />
          )}
          {canViewPartnerNotes && (
            <PartnerNotes
              productId={productId}
              authorId={user?.profile_id ?? user?.id ?? ""}
            />
          )}
        </div>
      )}

      {product.repository_url && (
        <DevelopmentHealthSection
          productId={productId}
          repositoryUrl={product.repository_url}
          specificationId={specification?.id}
        />
      )}

    </div>
  );
}

export { ProductOverview };
export type { ProductOverviewProps };
