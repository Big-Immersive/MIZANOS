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
  score: number;
  label: string;
}) {
  const color =
    score >= 80
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
            {score}%
          </span>
          <span className="text-xs text-muted-foreground mb-1">{label}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              score >= 80
                ? "bg-status-healthy"
                : score >= 50
                  ? "bg-status-warning"
                  : "bg-status-critical"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function computeSpecAlignment(scanResult: { gap_analysis?: { progress_pct?: number; verified?: number; total_tasks?: number } | null } | null | undefined): number {
  if (!scanResult?.gap_analysis) return 0;
  const ga = scanResult.gap_analysis;
  if (typeof ga.progress_pct === "number") return Math.round(ga.progress_pct);
  if (ga.total_tasks && ga.total_tasks > 0 && typeof ga.verified === "number") {
    return Math.round((ga.verified / ga.total_tasks) * 100);
  }
  return 0;
}

function computeCodeQuality(scanResult: { functional_inventory?: Array<{ confidence?: number; artifacts_found?: string[] }> | null; file_count?: number | null } | null | undefined): number {
  if (!scanResult?.functional_inventory?.length) return 0;
  const evidence = scanResult.functional_inventory;
  const totalTasks = evidence.length;
  if (totalTasks === 0) return 0;

  // Average confidence of task evidence (0-1 scale from LLM)
  const avgConfidence = evidence.reduce((sum, e) => sum + (e.confidence ?? 0), 0) / totalTasks;

  // Artifact coverage: how many tasks have at least one artifact found
  const tasksWithArtifacts = evidence.filter((e) => e.artifacts_found && e.artifacts_found.length > 0).length;
  const artifactCoverage = tasksWithArtifacts / totalTasks;

  // Weighted: 60% confidence + 40% artifact coverage
  return Math.round((avgConfidence * 60 + artifactCoverage * 40));
}

function computeStandards(scanResult: { gap_analysis?: { total_tasks?: number; verified?: number; partial?: number; no_evidence?: number } | null; file_count?: number | null } | null | undefined, analysis: { tech_stack?: unknown } | null | undefined): number {
  const techStack = (typeof analysis?.tech_stack === "object" && analysis.tech_stack !== null ? analysis.tech_stack : {}) as Record<string, unknown>;
  let score = 0;
  let checks = 0;

  // Check 1: Has repo description (from GitHub analysis)
  checks++;
  if (techStack.description) score++;

  // Check 2: Has multiple contributors
  checks++;
  const contributors = Number(techStack.contributors ?? 0);
  if (contributors > 1) score++;

  // Check 3: Reasonable file count (project has substance)
  checks++;
  const fileCount = scanResult?.file_count ?? 0;
  if (fileCount > 10) score++;

  // Check 4: Low no-evidence ratio (code covers most tasks)
  checks++;
  const ga = scanResult?.gap_analysis;
  if (ga && ga.total_tasks && ga.total_tasks > 0) {
    const noEvidenceRatio = (ga.no_evidence ?? 0) / ga.total_tasks;
    if (noEvidenceRatio < 0.3) score++;
  }

  // Check 5: Has verified tasks (code actually maps to spec)
  checks++;
  if (ga && (ga.verified ?? 0) > 0) score++;

  return checks > 0 ? Math.round((score / checks) * 100) : 0;
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

  // Use scan data for real scores, fall back to old analysis data
  const specAlignment = computeSpecAlignment(scanResult) || (analysis?.overall_score ?? 0);
  const codeQuality = computeCodeQuality(scanResult) || (audit?.overall_score ?? 0);
  const standards = computeStandards(scanResult, analysis);
  const overallScore = Math.round(specAlignment * 0.4 + codeQuality * 0.35 + standards * 0.25);

  const hasScanData = !!scanResult?.gap_analysis;
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
            {overallScore}%
          </div>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overallScore >= 80
                    ? "bg-status-healthy"
                    : overallScore >= 50
                      ? "bg-status-warning"
                      : "bg-status-critical"
                }`}
                style={{ width: `${overallScore}%` }}
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

        {!hasScanData && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Run a <strong>Code Progress Scan</strong> from the overview to get accurate health scores based on your actual codebase.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <HealthCard
            title="Spec Alignment"
            icon={FileCheck}
            score={specAlignment}
            label={hasScanData ? "tasks verified" : "from analysis"}
          />
          <HealthCard
            title="Standards"
            icon={Shield}
            score={standards}
            label="compliance"
          />
          <HealthCard
            title="Code Quality"
            icon={Code2}
            score={codeQuality}
            label={hasScanData ? "evidence quality" : "audit score"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
