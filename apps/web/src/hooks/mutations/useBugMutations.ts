"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksRepository } from "@/lib/api/repositories";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

export function useCreateBug(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<Task>): Promise<Task> =>
      tasksRepository.create({
        ...input,
        product_id: productId,
        task_type: "bug",
        status: input.status ?? "reported",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bugs", productId] });
      queryClient.invalidateQueries({ queryKey: ["bugs", "all"] });
      toast.success("Bug reported");
    },
    onError: (error: Error) => {
      toast.error("Failed to report bug: " + error.message);
    },
  });
}

export function useUpdateBug(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<Task>): Promise<Task> =>
      tasksRepository.update(id, updates),
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ["bugs", productId] });
      const previous = queryClient.getQueryData<Task[]>(["bugs", productId]);
      queryClient.setQueryData<Task[]>(["bugs", productId], (old) =>
        old?.map((bug) => (bug.id === id ? { ...bug, ...updates } : bug)),
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["bugs", productId], context.previous);
      }
      toast.error("Failed to update bug: " + error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bugs", productId] });
      queryClient.invalidateQueries({ queryKey: ["bugs", "all"] });
    },
  });
}

export function useDeleteBug(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bugId: string): Promise<void> =>
      tasksRepository.delete(bugId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bugs", productId] });
      queryClient.invalidateQueries({ queryKey: ["bugs", "all"] });
      toast.success("Bug deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete bug: " + error.message);
    },
  });
}
