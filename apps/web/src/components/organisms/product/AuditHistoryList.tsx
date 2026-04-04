"use client";

import { Card, CardContent } from "@/components/atoms/display/Card";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { Button } from "@/components/molecules/buttons/Button";
import { useAuditHistory } from "@/hooks/queries/useAuditHistory";
import { AuditHistoryItem } from "@/components/organisms/product/AuditHistoryItem";
import { History, Shield, Loader2, Play } from "lucide-react";
import { useRunAudit, useDeleteAudit } from "@/hooks/mutations/useAuditMutations";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import { AuditDashboard } from "./AuditDashboard";

interface AuditHistoryListProps {
  productId: string;
}

function AuditHistoryList({ productId }: AuditHistoryListProps) {
  const { data: audits, isLoading } = useAuditHistory(productId);
  const runAudit = useRunAudit(productId);
  const deleteAudit = useDeleteAudit(productId);
  const { isEngineer, isAdmin, isProjectManager } = useRoleVisibility();
  const isAIEngineerOnly = isEngineer && !isAdmin && !isProjectManager;
  const canDelete = !isAIEngineerOnly;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!audits || audits.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Audit History</h3>
          <p className="text-sm text-muted-foreground mb-4">Run your first code audit to see quality scores and trends.</p>
          <Button onClick={() => runAudit.mutate()} disabled={runAudit.isPending}>
            {runAudit.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run Audit
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AuditDashboard audits={audits} />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          All Audits ({audits.length})
        </h3>
        <Button variant="outline" size="sm" onClick={() => runAudit.mutate()} disabled={runAudit.isPending}>
          {runAudit.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
          Run Audit
        </Button>
      </div>

      <div className="space-y-2">
        {audits.map((audit, index) => (
          <AuditHistoryItem
            key={audit.id}
            audit={audit}
            isLatest={index === 0}
            canDelete={canDelete}
            onDelete={(id) => deleteAudit.mutate(id)}
            isDeleting={deleteAudit.isPending}
          />
        ))}
      </div>
    </div>
  );
}

export { AuditHistoryList };
export type { AuditHistoryListProps };
