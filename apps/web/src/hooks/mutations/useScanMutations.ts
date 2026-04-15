"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scansRepository } from "@/lib/api/repositories";
import type { Job } from "@/lib/types";
import { toast } from "sonner";

export function useTriggerHighLevelScan(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (): Promise<Job> => scansRepository.triggerHighLevel(productId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["scans", productId] });
      queryClient.invalidateQueries({ queryKey: ["jobs", job.id] });
      toast.success("Scan started — tracking progress");
    },
    onError: (error: Error) => {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("already in progress")) {
        toast.info("A scan is already running for this project. Please wait for it to finish.");
      } else {
        toast.error("Failed to start scan: " + msg);
      }
    },
  });
}

export function useCancelScan(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => scansRepository.cancelScan(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", productId] });
      toast.success("Scan cancelled");
    },
    onError: (error: Error) => {
      toast.error("Failed to cancel scan: " + error.message);
    },
  });
}
