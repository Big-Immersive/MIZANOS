"use client";

import { useQuery } from "@tanstack/react-query";
import { projectChecklistsRepository } from "@/lib/api/repositories/project-checklists.repository";
import type { ProjectChecklist } from "@/lib/types/checklist-template";

export function useProjectChecklists(productId: string, checklistType?: string) {
  return useQuery({
    queryKey: ["project-checklists", productId, checklistType ?? "all"],
    queryFn: (): Promise<ProjectChecklist[]> => projectChecklistsRepository.list(productId, checklistType),
    enabled: !!productId,
  });
}
