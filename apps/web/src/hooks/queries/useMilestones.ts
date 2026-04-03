"use client";

import { useQuery } from "@tanstack/react-query";
import { milestonesRepository } from "@/lib/api/repositories/milestones.repository";
import type { Milestone } from "@/lib/types/milestone";

export function useMilestones(productId: string) {
  return useQuery({
    queryKey: ["milestones", productId],
    queryFn: (): Promise<Milestone[]> => milestonesRepository.list(productId),
    enabled: !!productId,
  });
}
