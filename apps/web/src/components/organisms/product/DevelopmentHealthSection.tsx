"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Button } from "@/components/molecules/buttons/Button";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { useRepositoryAnalysis, useAnalyzeRepository } from "@/hooks/queries/useRepositoryAnalysis";
import { useLatestAudit } from "@/hooks/queries/useAuditHistory";
import { useRunAudit } from "@/hooks/mutations/useAuditMutations";
import { useScanResult, useProgressSummary } from "@/hooks/queries/useScans";
import {
  Activity,
  Code2,
  FileCheck,
  Shield,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface DevelopmentHealthSectionProps {
  productId: string;
  repositoryUrl: string;
  specificationId?: string;
}

function HealthCard({
  title,
  icon: Icon,
  score,
  label,
}: {
  title: string;
  icon: typeof Activity;
  score: number | null;
  label: string;
}) {
  const color =
    score === null
      ? "text-muted-foreground"
      : score >= 80
        ? "text-status-healthy"
        : score >= 50
          ? "text-status-warning"
          : "text-status-critical";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className={`text-2xl font-bold tabular-nums ${color}`}>
            {score === null ? "N/A" : `${score}%`}
          </span>
          <span className="text-xs text-muted-foreground mb-1">{label}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              score === null
                ? "bg-muted"
                : score >= 80
                  ? "bg-status-healthy"
                  : score >= 50
                    ? "bg-status-warning"
                    : "bg-status-critical"
            }`}
            style={{ width: `${score ?? 0}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}


type ScanResult = { gap_analysis?: { progress_pct?: number; verified?: number; total_tasks?: number } | null; functional_inventory?: Array<{ confidence?: number; artifacts_found?: string[] }> | null; file_count?: number | null } | null | undefined;
type AuditLite = { categories?: unknown } | null | undefined;

function computeSpecAlignment(scanResult: ScanResult): number | null {
  const ga = scanResult?.gap_analysis;
  if (!ga) return null;
  if (typeof ga.progress_pct === "number") return Math.round(ga.progress_pct);
  if (ga.total_tasks && ga.total_tasks > 0 && typeof ga.verified === "number") {
    return Math.round((ga.verified / ga.total_tasks) * 100);
  }
  return null;
}

function computeCodeQuality(scanResult: ScanResult): number | null {
  const evidence = scanResult?.functional_inventory;
  if (!evidence?.length) return null;
  const totalTasks = evidence.length;
  const avgConfidence = evidence.reduce((sum, e) => sum + (e.confidence ?? 0), 0) / totalTasks;
  const tasksWithArtifacts = evidence.filter((e) => e.artifacts_found && e.artifacts_found.length > 0).length;
  const artifactCoverage = tasksWithArtifacts / totalTasks;
  return Math.round(avgConfidence * 60 + artifactCoverage * 40);
}

/**
 * Standards = real audit `style` category score (LLM code review).
 * Returns null when no audit has been run — caller shows "N/A" + a CTA.
 */
function computeStandards(audit: AuditLite): number | null {
  if (!audit?.categories || typeof audit.categories !== "object") return null;
  const style = (audit.categories as Record<string, unknown>).style;
  if (typeof style !== "number") return null;
  return Math.round(style);
}

function weightedOverall(spec: number | null, quality: number | null, standards: number | null): number | null {
  const present: Array<[number, number]> = [];
  if (spec !== null) present.push([spec, 0.4]);
  if (quality !== null) present.push([quality, 0.35]);
  if (standards !== null) present.push([standards, 0.25]);
  if (present.length === 0) return null;
  const totalWeight = present.reduce((s, [, w]) => s + w, 0);
  return Math.round(present.reduce((s, [v, w]) => s + v * w, 0) / totalWeight);
}

export function DevelopmentHealthSection({
  productId,
  repositoryUrl,
}: DevelopmentHealthSectionProps) {
  const { data: analysis, isLoading: analysisLoading } = useRepositoryAnalysis(productId);
  const { data: audit, isLoading: auditLoading } = useLatestAudit(productId);
  const { data: scanResult, isLoading: scanLoading } = useScanResult(productId);
  const { data: progressSummary } = useProgressSummary(productId);
  const analyzeRepo = useAnalyzeRepository(productId);
  const runAudit = useRunAudit(productId);

  const isLoading = analysisLoading || auditLoading || scanLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Development Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // All three sub-scores come from real data sources; null means "no data yet"
  const specAlignment = computeSpecAlignment(scanResult);
  const codeQuality = computeCodeQuality(scanResult);
  const standards = computeStandards(audit);
  const overallScore = weightedOverall(specAlignment, codeQuality, standards);

  const hasScanData = !!scanResult?.gap_analysis || !!scanResult?.functional_inventory?.length;
  const hasAudit = standards !== null;
  const lastScanAt = progressSummary?.last_scan_at;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Development Health
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => analyzeRepo.mutate({ repositoryUrl })}
              disabled={analyzeRepo.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${analyzeRepo.isPending ? "animate-spin" : ""}`} />
              Analyze
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runAudit.mutate()}
              disabled={runAudit.isPending}
            >
              <Shield className="h-3.5 w-3.5 mr-1" />
              Audit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold tabular-nums">
            {overallScore === null ? "N/A" : `${overallScore}%`}
          </div>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overallScore === null
                    ? "bg-muted"
                    : overallScore >= 80
                      ? "bg-status-healthy"
                      : overallScore >= 50
                        ? "bg-status-warning"
                        : "bg-status-critical"
                }`}
                style={{ width: `${overallScore ?? 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">Overall Health Score</p>
              {lastScanAt && (
                <p className="text-[10px] text-muted-foreground">
                  Last scan: {new Date(lastScanAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {(!hasScanData || !hasAudit) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {!hasScanData && !hasAudit && (
                <>Run a <strong>Code Progress Scan</strong> and an <strong>Audit</strong> to populate health scores.</>
              )}
              {hasScanData && !hasAudit && (
                <>Run an <strong>Audit</strong> to see the Standards score (real LLM code review of style, security, performance, architecture).</>
              )}
              {!hasScanData && hasAudit && (
                <>Run a <strong>Code Progress Scan</strong> to populate Spec Alignment and Code Quality.</>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <HealthCard
            title="Spec Alignment"
            icon={FileCheck}
            score={specAlignment}
            label={specAlignment === null ? "not scanned" : "tasks verified"}
          />
          <HealthCard
            title="Standards"
            icon={Shield}
            score={standards}
            label={standards === null ? "run audit" : "style (audit)"}
          />
          <HealthCard
            title="Code Quality"
            icon={Code2}
            score={codeQuality}
            label={codeQuality === null ? "not scanned" : "evidence quality"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
