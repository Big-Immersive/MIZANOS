"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { Button } from "@/components/molecules/buttons/Button";
import { HealthScore } from "@/components/molecules/indicators/HealthScore";
import { useAuditHistory } from "@/hooks/queries/useAuditHistory";
import { AuditHistoryItem } from "@/components/organisms/product/AuditHistoryItem";
import type { Audit, JsonValue } from "@/lib/types";
import {
  History,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Loader2,
  Play,
} from "lucide-react";
import { useRunAudit, useDeleteAudit } from "@/hooks/mutations/useAuditMutations";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";

interface AuditHistoryListProps {
  productId: string;
}

interface AuditCategories {
  style: number;
  architecture: number;
  security: number;
  performance: number;
}

function parseCategories(categories: JsonValue): AuditCategories {
  if (
    categories &&
    typeof categories === "object" &&
    !Array.isArray(categories)
  ) {
    return {
      style: (categories.style as number) ?? 0,
      architecture: (categories.architecture as number) ?? 0,
      security: (categories.security as number) ?? 0,
      performance: (categories.performance as number) ?? 0,
    };
  }
  return { style: 0, architecture: 0, security: 0, performance: 0 };
}

function parseIssues(issues: JsonValue): Array<{ severity: string }> {
  if (Array.isArray(issues)) {
    return issues as Array<{ severity: string }>;
  }
  return [];
}

function TrendIndicator({ diff }: { diff: number }) {
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
        <TrendingUp className="h-4 w-4" />+{diff}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="flex items-center gap-1 text-destructive text-sm">
        <TrendingDown className="h-4 w-4" />
        {diff}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-sm">
      <Minus className="h-4 w-4" />0
    </span>
  );
}

function ComparisonCard({
  current,
  previous,
}: {
  current: Audit;
  previous: Audit;
}) {
  const currentCats = parseCategories(current.categories);
  const previousCats = parseCategories(previous.categories);
  const scoreDiff = current.overall_score - previous.overall_score;

  const diffs: Array<{ key: string; diff: number }> = [
    { key: "Overall", diff: scoreDiff },
    { key: "Code Confidence", diff: currentCats.style - previousCats.style },
    {
      key: "Architecture",
      diff: currentCats.architecture - previousCats.architecture,
    },
    { key: "Delivery Health", diff: currentCats.security - previousCats.security },
    {
      key: "Performance",
      diff: currentCats.performance - previousCats.performance,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Score Comparison
          <Badge variant="outline" className="font-normal">
            vs previous audit
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4">
          {diffs.map(({ key, diff }) => (
            <div key={key} className="text-center">
              <p className="text-sm text-muted-foreground mb-1">{key}</p>
              <TrendIndicator diff={diff} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type SeverityFilter = "all" | "critical" | "warning" | "info";

function AuditHistoryList({ productId }: AuditHistoryListProps) {
  const { data: audits, isLoading } = useAuditHistory(productId);
  const runAudit = useRunAudit(productId);
  const deleteAudit = useDeleteAudit(productId);
  const { isEngineer, isAdmin, isProjectManager } = useRoleVisibility();
  const isAIEngineerOnly = isEngineer && !isAdmin && !isProjectManager;
  const canDelete = !isAIEngineerOnly;
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const filteredAudits = useMemo(() => {
    if (!audits) return [];
    if (severityFilter === "all") return audits;
    return audits.filter((audit) => {
      const issues = parseIssues(audit.issues);
      return issues.some((i) => i.severity === severityFilter);
    });
  }, [audits, severityFilter]);

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
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Audit History
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Run your first code audit to see quality scores and trends.
          </p>
          <Button
            onClick={() => runAudit.mutate()}
            disabled={runAudit.isPending}
          >
            {runAudit.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Audit
          </Button>
        </CardContent>
      </Card>
    );
  }

  const latestAudit = audits[0];
  const previousAudit = audits.length > 1 ? audits[1] : null;

  return (
    <div className="space-y-6">
      {previousAudit && (
        <ComparisonCard current={latestAudit} previous={previousAudit} />
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          All Audits ({filteredAudits.length})
        </h3>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["all", "critical", "warning", "info"] as const).map((filter) => (
            <Button
              key={filter}
              variant={severityFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter(filter)}
              className="text-xs capitalize"
            >
              {filter}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runAudit.mutate()}
          disabled={runAudit.isPending}
        >
          {runAudit.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Run Audit
        </Button>
      </div>

      <div className="space-y-2">
        {filteredAudits.map((audit, index) => (
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
