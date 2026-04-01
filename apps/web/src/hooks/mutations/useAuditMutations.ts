"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { auditRepository } from "@/lib/api/repositories";
import type { Audit } from "@/lib/types";
import { toast } from "sonner";

export function useDeleteAudit(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (auditId: string): Promise<void> => auditRepository.deleteAudit(auditId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits", productId] });
      toast.success("Audit deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete audit: " + error.message);
    },
  });
}

export function useRunAudit(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (): Promise<Audit> => auditRepository.runAudit(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits", productId] });
      toast.success("Audit completed");
    },
    onError: (error: Error) => {
      toast.error("Audit failed: " + error.message);
    },
  });
}
