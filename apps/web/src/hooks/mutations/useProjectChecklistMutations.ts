"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectChecklistsRepository } from "@/lib/api/repositories/project-checklists.repository";
import { toast } from "sonner";
import type { ProjectChecklist } from "@/lib/types/checklist-template";

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
    mutationFn: ({ checklistId, ...data }: { checklistId: string; title: string; category?: string; status?: string; assignee_id?: string | null; due_date?: string | null }) =>
      projectChecklistsRepository.addItem(checklistId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-checklists", productId] }),
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useUpdateProjectChecklistItem(productId: string) {
  const qc = useQueryClient();
  const queryKey = ["project-checklists", productId];

  return useMutation({
    mutationFn: ({ itemId, ...data }: { itemId: string; status?: string; assignee_id?: string | null; due_date?: string | null; title?: string; category?: string }) =>
      projectChecklistsRepository.updateItem(itemId, data),

    onMutate: async ({ itemId, ...data }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<ProjectChecklist[]>(queryKey);

      qc.setQueryData<ProjectChecklist[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((cl) => ({
          ...cl,
          items: cl.items.map((item) =>
            item.id === itemId ? { ...item, ...data } : item,
          ),
          completed_count: cl.items.reduce((acc, item) => {
            const status = item.id === itemId ? (data.status ?? item.status) : item.status;
            return acc + (status === "complete" ? 1 : 0);
          }, 0),
        }));
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
      toast.error("Failed to update item");
    },

    onSettled: () => qc.invalidateQueries({ queryKey }),
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
