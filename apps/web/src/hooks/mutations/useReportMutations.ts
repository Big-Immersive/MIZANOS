"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsRepository } from "@/lib/api/repositories";
import type { AIAnalysis } from "@/lib/types";
import { toast } from "sonner";

export function useTriggerAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string): Promise<AIAnalysis> =>
      reportsRepository.triggerAnalysis(productId),
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({ queryKey: ["project-report", productId] });
      toast.success("AI analysis generated");
    },
    onError: (error: Error) => {
      toast.error("Analysis failed: " + error.message);
    },
  });
}
