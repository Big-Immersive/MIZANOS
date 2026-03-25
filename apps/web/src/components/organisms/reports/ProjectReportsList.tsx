"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { GitCommit, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/atoms/display/Card";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { Badge } from "@/components/atoms/display/Badge";
import { useReportsSummary } from "@/hooks/queries/useReports";
import { Loader2 } from "lucide-react";
import type { ProjectReportBrief } from "@/lib/types";

const STAGE_COLORS: Record<string, string> = {
  Intake: "bg-pillar-business/15 text-pillar-business",
  Development: "bg-pillar-development/15 text-pillar-development",
  QA: "bg-pillar-product/15 text-pillar-product",
  Deployment: "bg-status-warning/15 text-status-warning",
  Live: "bg-status-healthy/15 text-status-healthy",
  Production: "bg-status-healthy/15 text-status-healthy",
  Complete: "bg-status-healthy/15 text-status-healthy",
};

function stageBadgeClass(stage: string | null): string {
  if (!stage) return "bg-secondary text-muted-foreground";
  for (const [key, cls] of Object.entries(STAGE_COLORS)) {
    if (stage.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "bg-secondary text-muted-foreground";
}

export function ProjectReportsList() {
  const { data, isLoading } = useReportsSummary();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data?.projects) return [];
    if (!search.trim()) return data.projects;
    const q = search.toLowerCase();
    return data.projects.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        (p.pm_name?.toLowerCase().includes(q) ?? false) ||
        (p.dev_name?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.projects, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">
            Portfolio Directory
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <BaseInput
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>PM</Th>
                <Th>Dev</Th>
                <Th align="right">Tasks Done</Th>
                <Th align="right">In Progress</Th>
                <Th align="right">Commits</Th>
                <Th align="right">Recent Commit</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <ProjectRow key={p.product_id} project={p} index={i} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    No projects found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function ProjectRow({ project: p, index }: { project: ProjectReportBrief; index: number }) {
  return (
    <tr
      className="border-b last:border-0 hover:bg-accent/30 transition-colors"
      style={{ opacity: 0, animation: `fade-in 0.2s ease-out ${index * 30}ms forwards` }}
    >
      <td className="px-4 py-2.5">
        <Link
          href={`/reports/${p.product_id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {p.product_name}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="secondary" className={`text-[10px] ${stageBadgeClass(p.stage)}`}>
          {p.stage || "—"}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{p.pm_name || "—"}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{p.dev_name || "—"}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
        {p.completed_tasks}/{p.total_tasks}
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
        {p.in_progress_tasks}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
          {p.total_commits > 0 && <GitCommit className="h-3 w-3 text-muted-foreground" />}
          {p.total_commits}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        {p.last_scan_at ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono tabular-nums text-status-healthy">
              {p.recent_commits}
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(new Date(p.last_scan_at), "dd MMM, hh:mm a")}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground font-mono tabular-nums">0</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
        {format(new Date(p.created_at), "dd MMM yyyy")}
      </td>
    </tr>
  );
}
