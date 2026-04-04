"use client";

import { useState } from "react";

import { Plus, Trash2, Handshake, ChevronDown, ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/atoms/display/Card";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <div className="space-y-2">
              {(notes as PartnerNote[]).map((note, index) => {
                const isExpanded = expandedId === note.id;
                return (
                  <div key={note.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                        onClick={() => setExpandedId(isExpanded ? null : note.id)}
                      >
                        <span className="text-sm font-medium text-muted-foreground shrink-0 w-5">{index + 1}.</span>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{note.partner_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(note.created_at).toLocaleDateString()}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNote.mutate(note.id)}
                        className="shrink-0 ml-2"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 pl-5.5 border-t pt-2">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
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
