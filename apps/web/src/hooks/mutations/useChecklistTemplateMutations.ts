"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checklistTemplatesRepository } from "@/lib/api/repositories/checklist-templates.repository";
import { toast } from "sonner";

export function useCreateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; template_type: string; description?: string }) =>
      checklistTemplatesRepository.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist-templates"] }); toast.success("Template created"); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useUpdateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; template_type?: string; description?: string; is_active?: boolean }) =>
      checklistTemplatesRepository.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist-templates"] }); toast.success("Template updated"); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checklistTemplatesRepository.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist-templates"] }); toast.success("Template deleted"); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useAddChecklistTemplateItem(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; category?: string; default_status?: string }) =>
      checklistTemplatesRepository.addItem(templateId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-templates", templateId] }),
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useUpdateChecklistTemplateItem(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: { itemId: string; title?: string; category?: string; default_status?: string }) =>
      checklistTemplatesRepository.updateItem(templateId, itemId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-templates", templateId] }),
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useDeleteChecklistTemplateItem(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => checklistTemplatesRepository.deleteItem(templateId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-templates", templateId] }),
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useApplyChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, productId }: { templateId: string; productId: string }) =>
      checklistTemplatesRepository.apply(templateId, productId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-checklists"] }); toast.success("Template applied to project"); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useCreateChecklistCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => checklistTemplatesRepository.createCategory(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist-categories"] }); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}
