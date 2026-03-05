"use client";

import { useQuery } from "@tanstack/react-query";
import { scansRepository } from "@/lib/api/repositories";
import type { ProgressSummary, ScanHistoryEntry, ScanResult } from "@/lib/types";
import type { PaginatedResponse } from "@/lib/api/repositories";

export function useScanResult(productId: string) {
  return useQuery({
    queryKey: ["scans", productId, "latest"],
    queryFn: (): Promise<ScanResult | null> => scansRepository.getLatest(productId),
    enabled: !!productId,
  });
}

export function useScanHistory(productId: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["scans", productId, "history", page],
    queryFn: (): Promise<PaginatedResponse<ScanHistoryEntry>> =>
      scansRepository.getHistory(productId, { page, pageSize }),
    enabled: !!productId,
  });
}

export function useProgressSummary(productId: string) {
  return useQuery({
    queryKey: ["scans", productId, "progress-summary"],
    queryFn: (): Promise<ProgressSummary> =>
      scansRepository.getProgressSummary(productId),
    enabled: !!productId,
  });
}
