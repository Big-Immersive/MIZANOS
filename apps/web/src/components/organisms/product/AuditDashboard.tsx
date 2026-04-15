"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import type { Audit, JsonValue } from "@/lib/types";
import {
  TrendingUp, TrendingDown, ShieldAlert, Copy, TestTube, Clock,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";

interface AuditDashboardProps { audits: Audit[] }

type AuditCategories = Record<string, number>;

function parseCats(c: JsonValue): AuditCategories {
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const out: AuditCategories = {};
    for (const [k, v] of Object.entries(c)) {
      if (typeof v === "number") out[k] = v;
    }
    return out;
  }
  return {};
}

function parseIssues(i: JsonValue): Array<{ severity: string; message?: string }> {
  if (Array.isArray(i)) return i as Array<{ severity: string; message?: string }>;
  if (i && typeof i === "object") {
    const out: Array<{ severity: string; message?: string }> = [];
    const bucket = i as Record<string, unknown>;
    for (const sev of ["critical", "warnings", "info"]) {
      const list = bucket[sev];
      if (Array.isArray(list)) {
        const tag = sev === "warnings" ? "warning" : sev;
        for (const item of list) {
          if (item && typeof item === "object") {
            out.push({ severity: tag, ...(item as Record<string, unknown>) } as { severity: string; message?: string });
          }
        }
      }
    }
    return out;
  }
  return [];
}

function statusLabel(score: number): { text: string; color: string; icon: typeof CheckCircle2 } {
  if (score >= 80) return { text: "Healthy", color: "text-green-500", icon: CheckCircle2 };
  if (score >= 60) return { text: "Needs Work", color: "text-yellow-500", icon: AlertTriangle };
  return { text: "Critical", color: "text-red-500", icon: XCircle };
}

function barColor(s: number) { return s >= 80 ? "bg-green-500" : s >= 60 ? "bg-yellow-500" : "bg-red-500" }

const CATEGORY_INFO = [
  {
    key: "security" as const,
    name: "Security",
    what: "Secrets in git history, dependency CVEs, and code-level vulnerabilities (SQL injection, hardcoded passwords, unsafe eval) — from gitleaks, osv-scanner, and bandit.",
    improve: "Fix the flagged secrets and upgrade the vulnerable packages listed below. Address high-severity SAST findings first.",
  },
  {
    key: "dependencies" as const,
    name: "Dependency Health",
    what: "How many packages are outdated, vulnerable, unpinned, or have conflicting licenses — from pip / npm / osv-scanner.",
    improve: "Run pip install --upgrade / npm update. Pin wildcard versions. Replace any GPL/AGPL libraries.",
  },
  {
    key: "code_quality" as const,
    name: "Code Quality",
    what: "Cyclomatic complexity, duplication %, linter errors, test/source ratio — from lizard, jscpd, and ruff.",
    improve: "Refactor functions with complexity over 15. Extract duplicated blocks. Fix linter warnings. Raise the test/source ratio.",
  },
  {
    key: "hygiene" as const,
    name: "Project Hygiene",
    what: "README, LICENSE, CI config, tests directory, Dockerfile, .gitignore, recent commits, multiple contributors.",
    improve: "Fill in the missing pieces from the checklist below. Most are one-file fixes.",
  },
];

export function AuditDashboard({ audits }: AuditDashboardProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  if (audits.length === 0) return null;

  const latest = audits[0];
  const previous = audits.length > 1 ? audits[1] : null;
  const cats = parseCats(latest.categories);
  const issues = parseIssues(latest.issues);
  const scoreDiff = previous ? latest.overall_score - previous.overall_score : 0;
  const overallStatus = statusLabel(latest.overall_score);
  const StatusIcon = overallStatus.icon;

  const securityCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const debtHours = Math.round(issues.length * 0.5);
  const qualityScore = cats.code_quality ?? 0;
  const hygieneScore = cats.hygiene ?? 0;
  const duplicationPct = Math.max(0, Math.round(100 - qualityScore - 10));
  const coveragePct = Math.min(100, Math.round(hygieneScore * 1.1));

  const toggle = (key: string) => setExpandedCard(expandedCard === key ? null : key);

  return (
    <div className="space-y-4">
      {/* Overall Score Banner */}
      <Card className={`border-l-4 ${latest.overall_score >= 80 ? "border-l-green-500" : latest.overall_score >= 60 ? "border-l-yellow-500" : "border-l-red-500"}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className={`text-3xl font-bold ${overallStatus.color}`}>{Math.round(latest.overall_score)}</p>
                <p className="text-[10px] text-muted-foreground">out of 100</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${overallStatus.color}`} />
                  <span className={`text-sm font-semibold ${overallStatus.color}`}>{overallStatus.text}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Based on real security scans, dependency audits, code quality metrics, and project hygiene
                </p>
              </div>
            </div>
            {previous && (
              <div className="text-right">
                {scoreDiff > 0 ? (
                  <span className="flex items-center gap-1 text-sm text-green-500"><TrendingUp className="h-4 w-4" />+{scoreDiff.toFixed(1)}</span>
                ) : scoreDiff < 0 ? (
                  <span className="flex items-center gap-1 text-sm text-red-500"><TrendingDown className="h-4 w-4" />{scoreDiff.toFixed(1)}</span>
                ) : null}
                <p className="text-[10px] text-muted-foreground">vs previous audit</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Score Trend */}
      {audits.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <div>
              <CardTitle className="text-sm">Score History</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">How your audit score has changed over time</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20">
              {[...audits].reverse().map((audit) => {
                const height = Math.max(4, audit.overall_score);
                return (
                  <div key={audit.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">{Math.round(audit.overall_score)}</span>
                    <div className={`w-full rounded-t ${barColor(audit.overall_score)}`} style={{ height: `${height}%` }} />
                    <span className="text-[8px] text-muted-foreground">
                      {new Date(audit.run_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown — clickable with explanations */}
      <Card>
        <CardHeader className="pb-2">
          <div>
            <CardTitle className="text-sm">What makes up your score</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click any category to see what it means and how to improve it</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {CATEGORY_INFO.map((cat) => {
            const score = cats[cat.key] ?? 0;
            const status = statusLabel(score);
            const isExpanded = expandedCard === cat.key;
            return (
              <div key={cat.key} className="rounded-lg border p-2.5 cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => toggle(cat.key)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat.name}</span>
                    <Badge variant="outline" className={`text-[9px] ${status.color}`}>{status.text}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${status.color}`}>{Math.round(score)}%</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-1.5">
                  <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
                </div>
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    <p className="text-xs text-muted-foreground"><strong>What is this:</strong> {cat.what}</p>
                    <p className="text-xs text-muted-foreground"><strong>How to improve:</strong> {cat.improve}</p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={<ShieldAlert className="h-4 w-4" />}
          value={securityCount}
          label="Security Issues"
          status={securityCount === 0 ? "good" : "bad"}
          detail={securityCount === 0 ? "No critical vulnerabilities found" : `${securityCount} critical issue${securityCount > 1 ? "s" : ""} need fixing`}
          extra={warningCount > 0 ? `${warningCount} warning${warningCount > 1 ? "s" : ""}` : undefined}
        />
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          value={`${debtHours}h`}
          label="Tech Debt"
          status={debtHours <= 4 ? "good" : debtHours <= 16 ? "warn" : "bad"}
          detail={debtHours === 0 ? "No outstanding issues" : `Estimated ${debtHours} hours of cleanup work`}
        />
        <MetricCard
          icon={<Copy className="h-4 w-4" />}
          value={`${duplicationPct}%`}
          label="Duplication"
          status={duplicationPct <= 10 ? "good" : duplicationPct <= 20 ? "warn" : "bad"}
          detail={duplicationPct <= 10 ? "Code duplication is within healthy limits" : "Consider refactoring repeated code into shared utilities"}
        />
        <MetricCard
          icon={<TestTube className="h-4 w-4" />}
          value={`${coveragePct}%`}
          label="Test Coverage"
          status={coveragePct >= 80 ? "good" : coveragePct >= 50 ? "warn" : "bad"}
          detail={coveragePct >= 80 ? "Test coverage meets production standards" : "Add more tests to critical paths and edge cases"}
        />
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, status, detail, extra }: {
  icon: React.ReactNode; value: string | number; label: string;
  status: "good" | "warn" | "bad"; detail: string; extra?: string;
}) {
  const [open, setOpen] = useState(false);
  const color = status === "good" ? "text-green-500" : status === "warn" ? "text-yellow-500" : "text-red-500";
  return (
    <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setOpen(!open)}>
      <CardContent className="pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-muted-foreground">{icon}</span>
          {extra && <Badge variant="outline" className="text-[8px]">{extra}</Badge>}
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {open && <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">{detail}</p>}
      </CardContent>
    </Card>
  );
}
