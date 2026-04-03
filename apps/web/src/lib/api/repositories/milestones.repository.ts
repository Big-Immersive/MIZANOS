import type { Milestone } from "@/lib/types/milestone";
import { apiClient } from "../client";

class MilestonesRepository {
  async list(productId: string): Promise<Milestone[]> {
    const response = await apiClient.get<Milestone[]>(`/products/${productId}/milestones`);
    return response.data;
  }

  async create(productId: string, data: { title: string; description?: string; status?: string; priority?: string; pillar?: string; assignee_id?: string | null }): Promise<Milestone> {
    const response = await apiClient.post<Milestone>(`/products/${productId}/milestones`, data);
    return response.data;
  }

  async update(milestoneId: string, data: Partial<Milestone>): Promise<Milestone> {
    const response = await apiClient.patch<Milestone>(`/products/milestones/${milestoneId}`, data);
    return response.data;
  }

  async delete(milestoneId: string): Promise<void> {
    await apiClient.delete(`/products/milestones/${milestoneId}`);
  }

  async ensureDefault(productId: string): Promise<Milestone> {
    const response = await apiClient.post<Milestone>(`/products/${productId}/milestones/ensure-default`);
    return response.data;
  }
}

export const milestonesRepository = new MilestonesRepository();
