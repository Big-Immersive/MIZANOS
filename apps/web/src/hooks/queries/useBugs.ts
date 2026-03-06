"use client";

import { useQuery } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";

export function useBugs(productId: string) {
  return useQuery({
    queryKey: ["bugs", productId],
    queryFn: async (): Promise<Task[]> => {
      const result = await tasksRepository.getBugsByProduct(productId, {
        sortBy: "created_at",
        sortOrder: "desc",
      });
      return Array.isArray(result) ? result : result.data ?? [];
    },
    enabled: !!productId,
  });
}
