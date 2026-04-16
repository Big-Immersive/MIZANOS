"use client";

import { Card, CardContent } from "@/components/atoms/display/Card";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { useAuditHistory } from "@/hooks/queries/useAuditHistory";
import { AuditHistoryItem } from "@/components/organisms/product/AuditHistoryItem";
import { History, Shield } from "lucide-react";
import { useDeleteAudit } from "@/hooks/mutations/useAuditMutations";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import type { Audit, JsonValue } from "@/lib/types";
import { AuditDashboard } from "./AuditDashboard";

// An audit is "current" if it contains at least one key that exists ONLY
// in the new schema. The legacy schema also had a `security` key (task
// delivery rate) with the same name as the new one, so we can't use it
// as a discriminator — we look for dependencies / code_quality / hygiene.
const NEW_ONLY_KEYS = ["dependencies", "code_quality", "hygiene"] as const;

function isCurrentAudit(audit: Audit): boolean {
  const cats = audit.categories as JsonValue;
  if (!cats || typeof cats !== "object" || Array.isArray(cats)) return false;
  return NEW_ONLY_KEYS.some((k) => typeof (cats as Record<string, unknown>)[k] === "number");
}

interface AuditHistoryListProps {
  productId: string;
}

function AuditHistoryList({ productId }: AuditHistoryListProps) {
  const { data: rawAudits, isLoading } = useAuditHistory(productId);
  const deleteAudit = useDeleteAudit(productId);
  const { isEngineer, isAdmin, isProjectManager } = useRoleVisibility();
  const isAIEngineerOnly = isEngineer && !isAdmin && !isProjectManager;
  const canDelete = !isAIEngineerOnly;

  // Drop pre-refactor audits — they were computed from task state and don't
  // represent real code health. Run a Code Progress Scan from the Overview
  // tab to generate a real audit.
  const audits = (rawAudits ?? []).filter(isCurrentAudit);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Audit History</h3>
          <p className="text-sm text-muted-foreground">
            Audits are produced automatically by the Code Progress Scan. Open the project{"'"}s
            Overview tab and click <strong>Scan Now</strong> to generate the first one —
            security, dependency, code quality, and project hygiene scores all come out of
            the same scan pass.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AuditDashboard audits={audits} />

      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          All Audits ({audits.length})
        </h3>
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
