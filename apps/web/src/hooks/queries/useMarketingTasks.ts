"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";

export function useMarketingTasks(productId: string) {
  return useQuery({
    queryKey: ["marketing-tasks", productId],
    queryFn: async (): Promise<Task[]> => {
      const result = await tasksRepository.getMarketingTasksByProduct(productId, {
        sortBy: "created_at",
        sortOrder: "desc",
      });
      return Array.isArray(result) ? result : result.data ?? [];
    },
    enabled: !!productId,
  });
}

export function useSubtasks(parentId: string) {
  return useQuery({
    queryKey: ["subtasks", parentId],
    queryFn: (): Promise<Task[]> => tasksRepository.getSubtasks(parentId),
    enabled: !!parentId,
  });
}
