"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";

export interface AllTasksFilters {
  product_id?: string;
  assignee_id?: string;
  pm_id?: string;
  member_id?: string;
  status?: string;
  priority?: string;
  pillar?: string;
  search?: string;
}

export function useAllTasks(filters: AllTasksFilters = {}) {
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v && v !== "all"),
  );

  return useQuery({
    queryKey: ["tasks", "all", cleanFilters],
    queryFn: async (): Promise<Task[]> => {
      const result = await tasksRepository.getAll({ ...cleanFilters, task_type: "task", page_size: 500 });
      return Array.isArray(result) ? result : result.data ?? [];
    },
  });
}
