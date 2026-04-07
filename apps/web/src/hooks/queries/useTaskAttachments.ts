"use client";

import { useQuery } from "@tanstack/react-query";
import { taskAttachmentsRepository } from "@/lib/api/repositories";
import type { TaskAttachment } from "@/lib/types";

export function useTaskAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: (): Promise<TaskAttachment[]> =>
      taskAttachmentsRepository.listByTask(taskId!),
    enabled: !!taskId,
  });
}
