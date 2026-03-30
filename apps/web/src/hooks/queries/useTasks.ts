"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";

export function useTasks(productId: string) {
  return useQuery({
    queryKey: ["tasks", productId],
    queryFn: async (): Promise<Task[]> => {
      const result = await tasksRepository.getByProduct(productId, {
        sortBy: "created_at",
        sortOrder: "desc",
        page_size: 500,
      });
      // Backend returns a plain array, not paginated
      return Array.isArray(result) ? result : result.data ?? [];
    },
    enabled: !!productId,
  });
}

export function useTasksByAssignee(assigneeId: string) {
  return useQuery({
    queryKey: ["tasks", "assignee", assigneeId],
    queryFn: async (): Promise<Task[]> => {
      const result = await tasksRepository.getByAssignee(assigneeId);
      // Backend returns a plain array, not paginated
      return Array.isArray(result) ? result : result.data ?? [];
    },
    enabled: !!assigneeId,
  });
}
