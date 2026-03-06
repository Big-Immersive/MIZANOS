import type { Task, TaskTemplate } from "@/lib/types";
import { BaseRepository, type PaginatedResponse, type QueryParams } from "./base.repository";

interface BulkApproveResponse {
  approved_count: number;
  task_ids: string[];
}

interface BulkAssignResponse {
  assigned_count: number;
  task_ids: string[];
}

interface BulkUpdateResponse {
  updated_count: number;
  task_ids: string[];
}

export interface TaskRejectResponse {
  action: "deleted" | "cancelled";
  task_id: string;
}

interface BulkRejectResponse {
  results: TaskRejectResponse[];
}

export class TasksRepository extends BaseRepository<Task> {
  protected readonly basePath = "/tasks";

  async getByProduct(productId: string, params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.getAll({ ...params, product_id: productId, task_type: "task" });
  }

  async getBugsByProduct(productId: string, params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.getAll({ ...params, product_id: productId, task_type: "bug" });
  }

  async getMarketingTasksByProduct(productId: string, params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.getAll({ ...params, product_id: productId, task_type: "marketing_task" });
  }

  async getSubtasks(parentId: string): Promise<Task[]> {
    const response = await this.client.get<Task[]>(`${this.basePath}/${parentId}/subtasks`);
    return response.data;
  }

  async getByAssignee(assigneeId: string, params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.getAll({ ...params, assignee_id: assigneeId });
  }

  async getByStatus(status: string, params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.getAll({ ...params, status });
  }

  async getByPillar(pillar: string, params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.getAll({ ...params, pillar });
  }

  async reorder(taskId: string, newIndex: number, status?: string): Promise<void> {
    const params: Record<string, string | number> = { sort_order: newIndex };
    if (status) params.status = status;
    await this.client.patch(`${this.basePath}/${taskId}/reorder`, null, { params });
  }

  async getTemplates(sourceType?: string): Promise<TaskTemplate[]> {
    const response = await this.client.get<TaskTemplate[]>("/task-templates", {
      params: sourceType ? { source_type: sourceType } : undefined,
    });
    return response.data;
  }

  async getDrafts(productId: string): Promise<Task[]> {
    const response = await this.client.get<Task[]>(`${this.basePath}/drafts`, {
      params: { product_id: productId },
    });
    return response.data;
  }

  async deleteAllDrafts(productId: string): Promise<{ deleted_count: number }> {
    const response = await this.client.delete<{ deleted_count: number }>(
      `${this.basePath}/drafts`,
      { params: { product_id: productId } },
    );
    return response.data;
  }

  async approveTask(taskId: string): Promise<Task> {
    const response = await this.client.post<Task>(`${this.basePath}/${taskId}/approve`);
    return response.data;
  }

  async bulkApproveTasks(taskIds: string[]): Promise<BulkApproveResponse> {
    const response = await this.client.post<BulkApproveResponse>(
      `${this.basePath}/bulk-approve`,
      { task_ids: taskIds },
    );
    return response.data;
  }

  async rejectTask(taskId: string): Promise<TaskRejectResponse> {
    const response = await this.client.delete<TaskRejectResponse>(
      `${this.basePath}/${taskId}/reject`,
    );
    return response.data;
  }

  async bulkRejectTasks(taskIds: string[]): Promise<BulkRejectResponse> {
    const response = await this.client.post<BulkRejectResponse>(
      `${this.basePath}/bulk-reject`,
      { task_ids: taskIds },
    );
    return response.data;
  }

  async bulkUpdateTasks(
    taskIds: string[],
    updates: { assignee_id?: string | null; due_date?: string | null; priority?: string },
  ): Promise<BulkUpdateResponse> {
    const response = await this.client.post<BulkUpdateResponse>(
      `${this.basePath}/bulk-update`,
      { task_ids: taskIds, ...updates },
    );
    return response.data;
  }

  async bulkAssignTasks(taskIds: string[], assigneeId: string | null): Promise<BulkAssignResponse> {
    const response = await this.client.post<BulkAssignResponse>(
      `${this.basePath}/bulk-assign`,
      { task_ids: taskIds, assignee_id: assigneeId },
    );
    return response.data;
  }
}

export const tasksRepository = new TasksRepository();
