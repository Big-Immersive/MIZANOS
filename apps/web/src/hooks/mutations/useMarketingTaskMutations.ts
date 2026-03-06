"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

export function useCreateMarketingTask(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Task>): Promise<Task> =>
      tasksRepository.create({
        ...input,
        product_id: productId,
        task_type: "marketing_task",
        status: input.status ?? "planned",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks", productId] });
      toast.success("Marketing task created");
    },
    onError: (error: Error) => toast.error("Failed to create task: " + error.message),
  });
}

export function useCreateSubtask(productId: string, parentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Task>): Promise<Task> =>
      tasksRepository.create({
        ...input,
        product_id: productId,
        task_type: "marketing_task",
        parent_id: parentId,
        status: input.status ?? "planned",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentId] });
      toast.success("Subtask created");
    },
    onError: (error: Error) => toast.error("Failed to create subtask: " + error.message),
  });
}

export function useUpdateMarketingTask(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<Task>): Promise<Task> =>
      tasksRepository.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
    },
    onError: (error: Error) => toast.error("Failed to update task: " + error.message),
  });
}

export function useDeleteMarketingTask(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string): Promise<void> => tasksRepository.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      toast.success("Task deleted");
    },
    onError: (error: Error) => toast.error("Failed to delete task: " + error.message),
  });
}
