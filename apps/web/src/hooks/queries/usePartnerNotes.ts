"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsRepository } from "@/lib/api/repositories";
import { toast } from "sonner";

interface PartnerNote {
  id: string;
  product_id: string;
  author_id: string;
  partner_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CreatePartnerNoteData {
  product_id: string;
  author_id: string;
  partner_name: string;
  content: string;
}

export function usePartnerNotes(productId: string) {
  return useQuery({
    queryKey: ["partner-notes", productId],
    queryFn: async () => {
      const data = await productsRepository.getPartnerNotes(productId);
      return data as PartnerNote[];
    },
    enabled: !!productId,
  });
}

export function usePartnerNoteMutations(productId: string) {
  const queryClient = useQueryClient();
  const key = ["partner-notes", productId];

  const createNote = useMutation({
    mutationFn: (data: CreatePartnerNoteData) =>
      productsRepository.createPartnerNote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success("Release note added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add note: " + error.message);
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) =>
      productsRepository.deletePartnerNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success("Note deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete note: " + error.message);
    },
  });

  return { createNote, deleteNote };
}
