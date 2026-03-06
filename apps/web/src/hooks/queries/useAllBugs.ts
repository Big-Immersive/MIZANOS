"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";

export interface AllBugsFilters {
  product_id?: string;
  assignee_id?: string;
  pm_id?: string;
  member_id?: string;
  status?: string;
  priority?: string;
  search?: string;
}

export function useAllBugs(filters: AllBugsFilters = {}) {
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v && v !== "all"),
  );

  return useQuery({
    queryKey: ["bugs", "all", cleanFilters],
    queryFn: async (): Promise<Task[]> => {
      const result = await tasksRepository.getAll({ ...cleanFilters, task_type: "bug" });
      return Array.isArray(result) ? result : result.data ?? [];
    },
  });
}
