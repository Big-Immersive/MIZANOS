import type { AxiosInstance } from "axios";
import type {
  MarketingDomain,
  MarketingSocialHandle,
  MarketingCredential,
  MarketingChecklistItem,
} from "@/lib/types";
import { apiClient } from "../client";

export class MarketingRepository {
  private readonly client: AxiosInstance;
  private readonly basePath = "/marketing";

  constructor(client: AxiosInstance = apiClient) {
    this.client = client;
  }

  async getDomains(productId: string): Promise<MarketingDomain[]> {
    const response = await this.client.get<MarketingDomain[]>(
      `${this.basePath}/domains`,
      { params: { product_id: productId } },
    );
    return response.data;
  }

  async createDomain(data: Partial<MarketingDomain>): Promise<MarketingDomain> {
    const response = await this.client.post<MarketingDomain>(
      `${this.basePath}/domains`,
      data,
    );
    return response.data;
  }

  async updateDomain(domainId: string, data: Partial<MarketingDomain>): Promise<MarketingDomain> {
    const response = await this.client.patch<MarketingDomain>(
      `${this.basePath}/domains/${domainId}`,
      data,
    );
    return response.data;
  }

  async deleteDomain(domainId: string): Promise<void> {
    await this.client.delete(`${this.basePath}/domains/${domainId}`);
  }

  async getSocialHandles(productId: string): Promise<MarketingSocialHandle[]> {
    const response = await this.client.get<MarketingSocialHandle[]>(
      `${this.basePath}/social-handles`,
      { params: { product_id: productId } },
    );
    return response.data;
  }

  async createSocialHandle(data: Partial<MarketingSocialHandle>): Promise<MarketingSocialHandle> {
    const response = await this.client.post<MarketingSocialHandle>(
      `${this.basePath}/social-handles`,
      data,
    );
    return response.data;
  }

  async updateSocialHandle(handleId: string, data: Partial<MarketingSocialHandle>): Promise<MarketingSocialHandle> {
    const response = await this.client.patch<MarketingSocialHandle>(
      `${this.basePath}/social-handles/${handleId}`,
      data,
    );
    return response.data;
  }

  async deleteSocialHandle(handleId: string): Promise<void> {
    await this.client.delete(`${this.basePath}/social-handles/${handleId}`);
  }

  async getCredentials(productId: string): Promise<MarketingCredential[]> {
    const response = await this.client.get<MarketingCredential[]>(
      `${this.basePath}/credentials`,
      { params: { product_id: productId } },
    );
    return response.data;
  }

  async createCredential(data: {
    product_id: string;
    created_by: string;
    label: string;
    credential_type: string;
    username?: string;
    email?: string;
    password?: string;
    additional_info?: string;
  }): Promise<MarketingCredential> {
    const response = await this.client.post<MarketingCredential>(
      `${this.basePath}/credentials`,
      data,
    );
    return response.data;
  }

  async deleteCredential(credentialId: string): Promise<void> {
    await this.client.delete(`${this.basePath}/credentials/${credentialId}`);
  }

  async decryptCredential(credentialId: string): Promise<{ id: string; password: string | null }> {
    const response = await this.client.get<{ id: string; password: string | null }>(
      `${this.basePath}/credentials/${credentialId}/decrypt`,
    );
    return response.data;
  }

  async getChecklists(productId: string): Promise<MarketingChecklistItem[]> {
    const response = await this.client.get<MarketingChecklistItem[]>(
      `${this.basePath}/checklist`,
      { params: { product_id: productId } },
    );
    return response.data;
  }

  async toggleChecklistItem(itemId: string, isCompleted: boolean): Promise<MarketingChecklistItem> {
    const response = await this.client.patch<MarketingChecklistItem>(
      `${this.basePath}/checklist/${itemId}`,
      { is_completed: isCompleted },
    );
    return response.data;
  }

  async getTemplateTypes(): Promise<Array<{ source_type: string; item_count: number }>> {
    const response = await this.client.get<Array<{ source_type: string; item_count: number }>>(
      `${this.basePath}/checklist/templates`,
    );
    return response.data;
  }

  async applyTemplate(productId: string, sourceType: string): Promise<{ items_created: number }> {
    const response = await this.client.post<{ items_created: number }>(
      `${this.basePath}/checklist/apply-template`,
      { product_id: productId, source_type: sourceType },
    );
    return response.data;
  }

  async autoPopulate(data: {
    product_id: string;
    domains: Array<{ domain_name: string; ssl_status?: string; is_secured?: boolean }>;
    social_handles: Array<{ platform: string; handle: string; url?: string }>;
    logo_url?: string | null;
  }): Promise<{ domains_created: number; social_handles_created: number; logo_updated: boolean }> {
    const response = await this.client.post<{
      domains_created: number;
      social_handles_created: number;
      logo_updated: boolean;
    }>(`${this.basePath}/auto-populate`, data);
    return response.data;
  }
}

export const marketingRepository = new MarketingRepository();
