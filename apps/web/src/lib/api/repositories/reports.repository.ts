import type { AxiosInstance } from "axios";
import type {
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

  async getSummary(): Promise<ReportsSummary> {
    const response = await this.client.get<ReportsSummary>(
      `${this.basePath}/summary`,
    );
    return response.data;
  }

  async getProjectReport(productId: string): Promise<ProjectReportDetail> {
    const response = await this.client.get<ProjectReportDetail>(
      `${this.basePath}/projects/${productId}`,
    );
    return response.data;
  }

  async triggerAnalysis(productId: string): Promise<AIAnalysis> {
    const response = await this.client.post<AIAnalysis>(
      `${this.basePath}/projects/${productId}/analyze`,
    );
    return response.data;
  }

  async generateDocument(productIds: string[]): Promise<Blob> {
    const response = await this.client.post(
      `${this.basePath}/generate-document`,
      { product_ids: productIds },
      { responseType: "blob" },
    );
    return response.data;
  }
}

export const reportsRepository = new ReportsRepository();
