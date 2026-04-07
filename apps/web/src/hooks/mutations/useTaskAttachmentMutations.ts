"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskAttachmentsRepository } from "@/lib/api/repositories";
import type { TaskAttachment } from "@/lib/types";
import { toast } from "sonner";

export function useUploadAttachment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File): Promise<TaskAttachment> =>
      taskAttachmentsRepository.upload(taskId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("File uploaded");
    },
    onError: (error: Error) => {
      toast.error("Upload failed: " + error.message);
    },
  });
}

export function useDeleteAttachment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string): Promise<void> =>
      taskAttachmentsRepository.delete(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("Attachment deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });
}
