import type { AxiosInstance } from "axios";
import type {
  RecentCommit,
  ReportsSummary,
  ProjectReportDetail,
  AIAnalysis,
} from "@/lib/types";
import { apiClient } from "../client";

export class ReportsRepository {
  private readonly client: AxiosInstance;
  private readonly basePath = "/reports";

  constructor(client: AxiosInstance = apiClient) {
    this.client = client;
  }

  async getSummary(refresh = false): Promise<ReportsSummary> {
    const response = await this.client.get<ReportsSummary>(
      `${this.basePath}/summary`,
      { timeout: 120_000, params: refresh ? { refresh: true } : undefined },
    );
    return response.data;
  }

  async getProjectReport(productId: string): Promise<ProjectReportDetail> {
    const response = await this.client.get<ProjectReportDetail>(
      `${this.basePath}/projects/${productId}`,
    );
    return response.data;
  }

  async getRecentCommits(productId: string): Promise<RecentCommit[]> {
    const response = await this.client.get<RecentCommit[]>(
      `${this.basePath}/projects/${productId}/recent-commits`,
      { timeout: 30_000 },
    );
    return response.data;
  }

  async triggerAnalysis(productId: string): Promise<AIAnalysis> {
    const response = await this.client.post<AIAnalysis>(
      `${this.basePath}/projects/${productId}/analyze`,
      undefined,
      { timeout: 120_000 },
    );
    return response.data;
  }

  async generateDocument(
    productIds: string[], reportType: string = "general",
    taskStatuses?: string[], includeBugs?: boolean,
  ): Promise<Blob> {
    const response = await this.client.post(
      `${this.basePath}/generate-document`,
      {
        product_ids: productIds, report_type: reportType,
        ...(taskStatuses && { task_statuses: taskStatuses }),
        ...(includeBugs !== undefined && { include_bugs: includeBugs }),
      },
      { responseType: "blob", timeout: 180_000 },
    );
    return response.data;
  }

  async generateProjectPDF(productId: string): Promise<Blob> {
    const response = await this.client.get(
      `${this.basePath}/projects/${productId}/pdf`,
      { responseType: "blob", timeout: 180_000 },
    );
    return response.data;
  }

  async generatePDF(
    productIds: string[], reportType: string = "general",
    taskStatuses?: string[], includeBugs?: boolean,
  ): Promise<Blob> {
    const response = await this.client.post(
      `${this.basePath}/generate-pdf`,
      {
        product_ids: productIds, report_type: reportType,
        ...(taskStatuses && { task_statuses: taskStatuses }),
        ...(includeBugs !== undefined && { include_bugs: includeBugs }),
      },
      { responseType: "blob", timeout: 180_000 },
    );
    return response.data;
  }
}

export const reportsRepository = new ReportsRepository();
