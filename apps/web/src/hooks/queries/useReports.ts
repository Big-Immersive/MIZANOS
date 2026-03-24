"use client";

import { useQuery } from "@tanstack/react-query";
import { reportsRepository } from "@/lib/api/repositories";
import type { ReportsSummary, ProjectReportDetail } from "@/lib/types";

export function useReportsSummary() {
  return useQuery({
    queryKey: ["reports-summary"],
    queryFn: (): Promise<ReportsSummary> => reportsRepository.getSummary(),
    staleTime: 60_000,
  });
}

export function useProjectReport(productId: string) {
  return useQuery({
    queryKey: ["project-report", productId],
    queryFn: (): Promise<ProjectReportDetail> =>
      reportsRepository.getProjectReport(productId),
    enabled: !!productId,
    staleTime: 60_000,
  });
}
