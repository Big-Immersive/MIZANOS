"use client";

import { useQuery } from "@tanstack/react-query";
import { checklistTemplatesRepository } from "@/lib/api/repositories/checklist-templates.repository";
import type { ChecklistTemplate, ChecklistTemplateDetail, ChecklistCategory } from "@/lib/types/checklist-template";

export function useChecklistTemplates(templateType?: string) {
  return useQuery({
    queryKey: ["checklist-templates", templateType ?? "all"],
    queryFn: (): Promise<ChecklistTemplate[]> => checklistTemplatesRepository.list(templateType),
  });
}

export function useChecklistTemplateDetail(templateId: string) {
  return useQuery({
    queryKey: ["checklist-templates", templateId, "detail"],
    queryFn: (): Promise<ChecklistTemplateDetail> => checklistTemplatesRepository.getDetail(templateId),
    enabled: !!templateId,
  });
}

export function useChecklistCategories() {
  return useQuery({
    queryKey: ["checklist-categories"],
    queryFn: (): Promise<ChecklistCategory[]> => checklistTemplatesRepository.listCategories(),
  });
}
