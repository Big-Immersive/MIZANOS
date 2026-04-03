"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

export function useCreateTask(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<Task>): Promise<Task> =>
      tasksRepository.create({ ...input, product_id: productId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
      toast.success("Task created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create task: " + error.message);
    },
  });
}

export function useUpdateTask(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<Task>): Promise<Task> =>
      tasksRepository.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
      queryClient.invalidateQueries({ queryKey: ["milestones", productId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update task: " + error.message);
    },
  });
}

export function useDeleteTask(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string): Promise<void> =>
      tasksRepository.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
      toast.success("Task deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete task: " + error.message);
    },
  });
}

export function useBulkAssignTasks(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskIds, assigneeId }: { taskIds: string[]; assigneeId: string | null }) =>
      tasksRepository.bulkAssignTasks(taskIds, assigneeId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
      toast.success(`Assigned ${data.assigned_count} task${data.assigned_count !== 1 ? "s" : ""}`);
    },
    onError: (error: Error) => {
      toast.error("Failed to assign tasks: " + error.message);
    },
  });
}

export function useBulkUpdateTasks(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskIds,
      updates,
    }: {
      taskIds: string[];
      updates: { assignee_id?: string | null; due_date?: string | null; priority?: string; status?: string; pillar?: string };
    }) => tasksRepository.bulkUpdateTasks(taskIds, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", productId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
      toast.success(`Updated ${data.updated_count} task${data.updated_count !== 1 ? "s" : ""}`);
    },
    onError: (error: Error) => {
      toast.error("Failed to update tasks: " + error.message);
    },
  });
}

export function useReorderTask() {
  return useMutation({
    mutationFn: ({
      taskId,
      newIndex,
      status,
    }: {
      taskId: string;
      newIndex: number;
      status?: string;
    }): Promise<void> => tasksRepository.reorder(taskId, newIndex, status),
  });
}
