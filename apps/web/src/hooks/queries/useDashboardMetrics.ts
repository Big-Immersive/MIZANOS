"use client";

import { useQuery } from "@tanstack/react-query";
import { productsRepository, tasksRepository, auditRepository, notificationsRepository } from "@/lib/api/repositories";
import { useAuth } from "@/contexts/AuthContext";
import type { Product, Task, Audit, Notification } from "@/lib/types";

export interface DashboardMetrics {
  overdueTasks: Array<{
    id: string;
    title: string;
    due_date: string;
    product_id: string;
    product_name: string;
    assignee_name: string | null;
    priority: string;
  }>;
  dueSoonTasks: Array<{
    id: string;
    title: string;
    due_date: string;
    product_id: string;
    product_name: string;
    priority: string;
  }>;
  atRiskProjects: Array<{
    product_id: string;
    product_name: string;
    reason: string;
  }>;
  lowScoreAudits: Array<{
    product_id: string;
    product_name: string;
    overall_score: number;
    run_at: string;
  }>;
  incompleteDeployments: Array<{
    product_id: string;
    product_name: string;
    total_items: number;
    completed_items: number;
    stage: string;
  }>;
  stageDistribution: Array<{
    stage: string;
    count: number;
  }>;
  projectsByStage: Record<string, Array<{ id: string; name: string }>>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    product_id: string;
    product_name: string;
    created_at: string;
  }>;
}

export function useDashboardMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-metrics", user?.id],
    queryFn: async (): Promise<DashboardMetrics> => {
      const [productsResult, allTasksResult, notifications] = await Promise.all([
        productsRepository.getAll({ pageSize: 100 }),
        tasksRepository.getAll({ pageSize: 500, task_type: "task" }),
        notificationsRepository.getAll(),
      ]);

      const products = Array.isArray(productsResult) ? productsResult : productsResult.data ?? [];
      const allTasks: Task[] = Array.isArray(allTasksResult) ? allTasksResult : allTasksResult.data ?? [];

      const productMap = new Map<string, string>();
      for (const p of products) productMap.set(p.id, p.name);

      // Stage distribution + projects by stage
      const stageMap: Record<string, number> = {};
      const projectsByStage: Record<string, Array<{ id: string; name: string }>> = {};
      for (const p of products) {
        const stage = p.stage || "Unknown";
        stageMap[stage] = (stageMap[stage] || 0) + 1;
        if (!projectsByStage[stage]) {
          projectsByStage[stage] = [];
        }
        projectsByStage[stage].push({ id: p.id, name: p.name });
      }
      const stageDistribution = Object.entries(stageMap).map(
        ([stage, count]) => ({ stage, count }),
      );

      // Overdue tasks
      const now = new Date();
      const overdueTasks = allTasks
        .filter((t) => t.due_date && new Date(t.due_date) < now && t.status !== "done" && t.status !== "live" && t.status !== "cancelled")
        .slice(0, 20)
        .map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date!,
          product_id: t.product_id,
          product_name: productMap.get(t.product_id) ?? "Unknown",
          assignee_name: null as string | null,
          priority: t.priority ?? "medium",
        }));

      // Tasks due within 3 days (not overdue yet)
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const overdueIds = new Set(overdueTasks.map((t) => t.id));
      const dueSoonTasks = allTasks
        .filter((t) =>
          t.due_date &&
          !overdueIds.has(t.id) &&
          new Date(t.due_date) >= now &&
          new Date(t.due_date) <= threeDaysFromNow &&
          t.status !== "done" && t.status !== "live" && t.status !== "cancelled"
        )
        .slice(0, 10)
        .map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date!,
          product_id: t.product_id,
          product_name: productMap.get(t.product_id) ?? "Unknown",
          priority: t.priority ?? "medium",
        }));

      // Low score audits — fetch latest audit per product
      const lowScoreAudits: DashboardMetrics["lowScoreAudits"] = [];
      for (const p of products) {
        try {
          const audit = await auditRepository.getLatest(p.id);
          if (audit && audit.overall_score < 60) {
            lowScoreAudits.push({
              product_id: p.id,
              product_name: p.name,
              overall_score: Math.round(audit.overall_score),
              run_at: audit.run_at,
            });
          }
        } catch {
          // skip
        }
      }

      // Recent activity
      const recentActivity = notifications.slice(0, 10).map((n: Notification) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        product_id: n.product_id || "",
        product_name: productMap.get(n.product_id || "") ?? "",
        created_at: n.created_at,
      }));

      // At Risk = projects with low audit scores OR projects with 3+ overdue tasks
      const overdueByProduct = new Map<string, number>();
      for (const t of overdueTasks) {
        overdueByProduct.set(t.product_id, (overdueByProduct.get(t.product_id) || 0) + 1);
      }
      const atRiskProjects: Array<{
        product_id: string;
        product_name: string;
        reason: string;
      }> = [];

      // Add projects with low audit scores
      for (const audit of lowScoreAudits) {
        atRiskProjects.push({
          product_id: audit.product_id,
          product_name: audit.product_name,
          reason: `Low audit score: ${audit.overall_score}%`,
        });
      }

      // Add projects with 3+ overdue tasks (if not already added)
      const addedIds = new Set(atRiskProjects.map(p => p.product_id));
      for (const [pid, count] of overdueByProduct) {
        if (count >= 3 && !addedIds.has(pid)) {
          atRiskProjects.push({
            product_id: pid,
            product_name: productMap.get(pid) ?? "Unknown",
            reason: `${count} overdue tasks`,
          });
        }
      }

      return {
        overdueTasks,
        dueSoonTasks,
        atRiskProjects,
        lowScoreAudits,
        incompleteDeployments: [],
        stageDistribution,
        projectsByStage,
        recentActivity,
      };
    },
    staleTime: 30_000,
  });
}
