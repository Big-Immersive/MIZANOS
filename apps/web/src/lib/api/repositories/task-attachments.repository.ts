import type { TaskAttachment } from "@/lib/types";
import { apiClient } from "../client";

class TaskAttachmentsRepository {
  private basePath = "/task-attachments";

  async upload(taskId: string, file: File): Promise<TaskAttachment> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<TaskAttachment>(
      `${this.basePath}/upload/${taskId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  }

  async listByTask(taskId: string): Promise<TaskAttachment[]> {
    const response = await apiClient.get<TaskAttachment[]>(
      `${this.basePath}/${taskId}`,
    );
    return response.data;
  }

  async delete(attachmentId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${attachmentId}`);
  }
}

export const taskAttachmentsRepository = new TaskAttachmentsRepository();
