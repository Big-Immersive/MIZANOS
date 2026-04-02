"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectChecklistsRepository } from "@/lib/api/repositories/project-checklists.repository";
import { toast } from "sonner";

export function useDeleteProjectChecklist(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checklistId: string) => projectChecklistsRepository.delete(checklistId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-checklists", productId] }); toast.success("Checklist removed"); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useAddProjectChecklistItem(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ checklistId, ...data }: { checklistId: string; title: string; category?: string; assignee_id?: string | null; due_date?: string | null }) =>
      projectChecklistsRepository.addItem(checklistId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-checklists", productId] }),
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useUpdateProjectChecklistItem(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: { itemId: string; status?: string; assignee_id?: string | null; due_date?: string | null; title?: string; category?: string }) =>
      projectChecklistsRepository.updateItem(itemId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-checklists", productId] }),
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useDeleteProjectChecklistItem(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => projectChecklistsRepository.deleteItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-checklists", productId] }),
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}
