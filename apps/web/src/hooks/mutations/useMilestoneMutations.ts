"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { milestonesRepository } from "@/lib/api/repositories/milestones.repository";
import { toast } from "sonner";

export function useCreateMilestone(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; status?: string; priority?: string; pillar?: string; assignee_id?: string | null; assignee_ids?: string[]; due_date?: string | null; created_at?: string }) =>
      milestonesRepository.create(productId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones", productId] }); toast.success("Milestone created"); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useUpdateMilestone(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; description?: string; status?: string; priority?: string; pillar?: string; assignee_id?: string | null; assignee_ids?: string[]; due_date?: string | null; created_at?: string }) =>
      milestonesRepository.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones", productId] }); toast.success("Milestone updated"); },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}

export function useDeleteMilestone(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => milestonesRepository.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones", productId] });
      qc.invalidateQueries({ queryKey: ["tasks", productId] });
      toast.success("Milestone and tasks deleted");
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });
}
