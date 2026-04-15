"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import type { Audit, JsonValue } from "@/lib/types";
import {
  TrendingUp, TrendingDown,
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

function statusLabel(score: number): { text: string; color: string; icon: typeof CheckCircle2 } {
  if (score >= 80) return { text: "Healthy", color: "text-green-500", icon: CheckCircle2 };
  if (score >= 60) return { text: "Needs Work", color: "text-yellow-500", icon: AlertTriangle };
  return { text: "Critical", color: "text-red-500", icon: XCircle };
}

type Finding = { severity?: string; title?: string; tool?: string; category?: string; file?: string; line?: number };

function collectFindings(issues: JsonValue): Finding[] {
  const out: Finding[] = [];
  if (!issues || typeof issues !== "object" || Array.isArray(issues)) return out;
  const bucket = issues as Record<string, unknown>;
  for (const key of ["critical", "warnings", "info"]) {
    const list = bucket[key];
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && typeof item === "object") out.push(item as Finding);
      }
    }
  }
  return out;
}

function groupByCategory(findings: Finding[], category: string): Finding[] {
  return findings.filter((f) => (f.category ?? "") === category);
}

function buildWhy(category: string, score: number, findings: Finding[]): { summary: string; top: Finding[] } {
  const crit = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;
  const tools = Array.from(new Set(findings.map((f) => f.tool).filter(Boolean))) as string[];
  const toolText = tools.length ? ` (${tools.join(", ")})` : "";

  if (findings.length === 0) {
    if (score >= 95) return { summary: "No findings — all checks passed.", top: [] };
    return { summary: "Score reflects a baseline deduction; no individual findings recorded.", top: [] };
  }

  const parts: string[] = [];
  if (crit) parts.push(`${crit} critical`);
  if (high) parts.push(`${high} high`);
  if (medium) parts.push(`${medium} medium`);
  if (low) parts.push(`${low} low`);
  const breakdown = parts.join(" · ");

  let prefix = "";
  switch (category) {
    case "security":
      prefix = `${findings.length} security finding${findings.length === 1 ? "" : "s"}: `;
      break;
    case "dependencies":
      prefix = `${findings.length} dependency vulnerabilit${findings.length === 1 ? "y" : "ies"}: `;
      break;
    case "code_quality":
      prefix = `${findings.length} code-quality issue${findings.length === 1 ? "" : "s"}: `;
      break;
    case "hygiene":
      prefix = `${findings.length} hygiene check${findings.length === 1 ? "" : "s"} failed: `;
      break;
  }

  return {
    summary: `${prefix}${breakdown}${toolText}.`,
    top: findings.slice(0, 5),
  };
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
  const allFindings = collectFindings(latest.issues);
  const scoreDiff = previous ? latest.overall_score - previous.overall_score : 0;
  const overallStatus = statusLabel(latest.overall_score);
  const StatusIcon = overallStatus.icon;

  const toggle = (key: string) => setExpandedCard(expandedCard === key ? null : key);

  return (
    <div className="space-y-4">
      {/* Overall Score Banner */}
      <Card className={`border-l-4 ${latest.overall_score >= 80 ? "border-l-green-500" : latest.overall_score >= 60 ? "border-l-yellow-500" : "border-l-red-500"}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-bold tabular-nums leading-none ${overallStatus.color}`}>
                  {Math.round(latest.overall_score)}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${overallStatus.color}`} />
                  <span className={`text-sm font-semibold ${overallStatus.color}`}>{overallStatus.text}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Composite score across security, dependencies, code quality and project hygiene — computed from real static-analysis tools.
                </p>
              </div>
            </div>
            {previous && scoreDiff !== 0 && (
              <div className="text-right shrink-0">
                {scoreDiff > 0 ? (
                  <span className="flex items-center justify-end gap-1 text-sm font-medium text-green-500 tabular-nums">
                    <TrendingUp className="h-4 w-4" />+{scoreDiff.toFixed(1)}
                  </span>
                ) : (
                  <span className="flex items-center justify-end gap-1 text-sm font-medium text-red-500 tabular-nums">
                    <TrendingDown className="h-4 w-4" />{scoreDiff.toFixed(1)}
                  </span>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">vs previous audit</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                {isExpanded && (() => {
                  const catFindings = groupByCategory(allFindings, cat.key);
                  const why = buildWhy(cat.key, score, catFindings);
                  return (
                    <div className="mt-2 pt-2 border-t space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-muted-foreground"><strong className="text-foreground">What is this:</strong> {cat.what}</p>
                      <p className="text-xs text-muted-foreground"><strong className="text-foreground">Why this score:</strong> {why.summary}</p>
                      {why.top.length > 0 && (
                        <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                          {why.top.map((f, i) => (
                            <li key={i}>
                              <span className="text-foreground">{f.title || "Finding"}</span>
                              {f.file && <span className="opacity-70"> — {f.file}{f.line ? `:${f.line}` : ""}</span>}
                              {f.tool && <span className="opacity-50"> [{f.tool}]</span>}
                            </li>
                          ))}
                          {catFindings.length > why.top.length && (
                            <li className="list-none opacity-70">+ {catFindings.length - why.top.length} more</li>
                          )}
                        </ul>
                      )}
                      <p className="text-xs text-muted-foreground"><strong className="text-foreground">How to improve:</strong> {cat.improve}</p>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </CardContent>
      </Card>

    </div>
  );
}
