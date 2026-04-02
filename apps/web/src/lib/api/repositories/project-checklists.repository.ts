import type { ProjectChecklist, ProjectChecklistItem } from "@/lib/types/checklist-template";
import { apiClient } from "../client";

class ProjectChecklistsRepository {
  private readonly basePath = "/project-checklists";

  async list(productId: string, checklistType?: string): Promise<ProjectChecklist[]> {
    const params: Record<string, string> = { product_id: productId };
    if (checklistType) params.checklist_type = checklistType;
    const response = await apiClient.get<ProjectChecklist[]>(this.basePath, { params });
    return response.data;
  }

  async get(checklistId: string): Promise<ProjectChecklist> {
    const response = await apiClient.get<ProjectChecklist>(`${this.basePath}/${checklistId}`);
    return response.data;
  }

  async delete(checklistId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${checklistId}`);
  }

  async addItem(checklistId: string, data: { title: string; category?: string; assignee_id?: string | null; due_date?: string | null }): Promise<ProjectChecklistItem> {
    const response = await apiClient.post<ProjectChecklistItem>(`${this.basePath}/${checklistId}/items`, data);
    return response.data;
  }

  async updateItem(itemId: string, data: Partial<ProjectChecklistItem>): Promise<ProjectChecklistItem> {
    const response = await apiClient.patch<ProjectChecklistItem>(`${this.basePath}/items/${itemId}`, data);
    return response.data;
  }

  async deleteItem(itemId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/items/${itemId}`);
  }
}

export const projectChecklistsRepository = new ProjectChecklistsRepository();
