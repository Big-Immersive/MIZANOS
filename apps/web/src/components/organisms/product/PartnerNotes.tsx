"use client";

import { useState } from "react";

import { Plus, Trash2, Handshake } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import { Button } from "@/components/molecules/buttons/Button";
import { usePartnerNotes, usePartnerNoteMutations } from "@/hooks/queries/usePartnerNotes";
import { AddNoteDialog, type NoteFormData } from "./AddNoteDialog";

interface PartnerNotesProps {
  productId: string;
  authorId: string;
}

interface PartnerNote {
  id: string;
  product_id: string;
  author_id: string;
  partner_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function PartnerNotes({ productId, authorId }: PartnerNotesProps) {
  const { data: notes = [], isLoading } = usePartnerNotes(productId);
  const { createNote, deleteNote } = usePartnerNoteMutations(productId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAdd = (data: NoteFormData) => {
    createNote.mutate(
      {
        product_id: productId,
        author_id: authorId,
        content: data.content,
        partner_name: data.partner_name ?? "",
      },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Handshake className="h-4 w-4" />
            Release Notes ({notes.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No release notes yet. These are visible to external partners.
            </p>
          ) : (
            <div className="space-y-3">
              {(notes as PartnerNote[]).map((note) => (
                <div key={note.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">
                        {note.partner_name}
                      </Badge>
                      <p className="text-sm whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNote.mutate(note.id)}
                      className="shrink-0 ml-2"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(note.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddNoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type="partner"
        onSubmit={handleAdd}
        isSubmitting={createNote.isPending}
      />
    </>
  );
}

export { PartnerNotes };
export type { PartnerNotesProps };
