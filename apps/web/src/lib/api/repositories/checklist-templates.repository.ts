import type { ChecklistTemplate, ChecklistTemplateDetail, ChecklistTemplateItem, ChecklistCategory } from "@/lib/types/checklist-template";
import { apiClient } from "../client";

class ChecklistTemplatesRepository {
  private readonly basePath = "/checklist-templates";

  async list(templateType?: string): Promise<ChecklistTemplate[]> {
    const params = templateType ? { template_type: templateType } : {};
    const response = await apiClient.get<ChecklistTemplate[]>(this.basePath, { params });
    return response.data;
  }

  async getDetail(id: string): Promise<ChecklistTemplateDetail> {
    const response = await apiClient.get<ChecklistTemplateDetail>(`${this.basePath}/${id}`);
    return response.data;
  }

  async create(data: { name: string; template_type: string; description?: string }): Promise<ChecklistTemplateDetail> {
    const response = await apiClient.post<ChecklistTemplateDetail>(this.basePath, data);
    return response.data;
  }

  async update(id: string, data: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {
    const response = await apiClient.patch<ChecklistTemplate>(`${this.basePath}/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${id}`);
  }

  // Items
  async addItem(templateId: string, data: { title: string; category?: string; default_status?: string }): Promise<ChecklistTemplateItem> {
    const response = await apiClient.post<ChecklistTemplateItem>(`${this.basePath}/${templateId}/items`, data);
    return response.data;
  }

  async updateItem(templateId: string, itemId: string, data: Partial<ChecklistTemplateItem>): Promise<ChecklistTemplateItem> {
    const response = await apiClient.patch<ChecklistTemplateItem>(`${this.basePath}/${templateId}/items/${itemId}`, data);
    return response.data;
  }

  async deleteItem(templateId: string, itemId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${templateId}/items/${itemId}`);
  }

  async reorderItems(templateId: string, orderedIds: string[]): Promise<void> {
    await apiClient.put(`${this.basePath}/${templateId}/items/reorder`, { ordered_ids: orderedIds });
  }

  // Apply
  async apply(templateId: string, productId: string): Promise<unknown> {
    const response = await apiClient.post(`${this.basePath}/${templateId}/apply`, { product_id: productId });
    return response.data;
  }

  // Categories
  async listCategories(): Promise<ChecklistCategory[]> {
    const response = await apiClient.get<ChecklistCategory[]>(`${this.basePath}/categories/all`);
    return response.data;
  }

  async createCategory(name: string): Promise<ChecklistCategory> {
    const response = await apiClient.post<ChecklistCategory>(`${this.basePath}/categories`, { name });
    return response.data;
  }
}

export const checklistTemplatesRepository = new ChecklistTemplatesRepository();
