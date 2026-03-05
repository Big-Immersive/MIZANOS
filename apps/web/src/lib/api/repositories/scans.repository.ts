import type { Job } from "@/lib/types/job";
import type { ProgressSummary, ScanHistoryEntry, ScanResult } from "@/lib/types/scan";
import { BaseRepository, type PaginatedResponse, type QueryParams } from "./base.repository";

export class ScansRepository extends BaseRepository<ScanResult> {
  protected readonly basePath = "/scans";

  async triggerHighLevel(productId: string): Promise<Job> {
    const response = await this.client.post<Job>(
      `${this.basePath}/${productId}/high-level`,
    );
    return response.data;
  }

  async getLatest(productId: string): Promise<ScanResult | null> {
    const response = await this.client.get<ScanResult | null>(
      `${this.basePath}/${productId}/latest`,
    );
    return response.data;
  }

  async getHistory(
    productId: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<ScanHistoryEntry>> {
    const response = await this.client.get<PaginatedResponse<ScanHistoryEntry>>(
      `${this.basePath}/${productId}/history`,
      { params },
    );
    return response.data;
  }

  async getProgressSummary(productId: string): Promise<ProgressSummary> {
    const response = await this.client.get<ProgressSummary>(
      `${this.basePath}/${productId}/progress-summary`,
    );
    return response.data;
  }
}

export const scansRepository = new ScansRepository();
