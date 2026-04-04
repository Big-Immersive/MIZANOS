"use client";

import { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/layout/Dialog";
import { Button } from "@/components/molecules/buttons/Button";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { BaseLabel } from "@/components/atoms/inputs/BaseLabel";
import { BaseTextarea } from "@/components/atoms/inputs/BaseTextarea";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "management" | "partner";
  onSubmit: (data: NoteFormData) => void;
  isSubmitting?: boolean;
}

interface NoteFormData {
  content: string;
  partner_name?: string;
}

function AddNoteDialog({
  open,
  onOpenChange,
  type,
  onSubmit,
  isSubmitting,
}: AddNoteDialogProps) {
  const [content, setContent] = useState("");
  const [partnerName, setPartnerName] = useState("");

  useEffect(() => {
    if (open) {
      setContent("");
      setPartnerName("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      content,
      ...(type === "partner" ? { partner_name: partnerName } : {}),
    });
  };

  const title =
    type === "management" ? "Add Management Note" : "Add Release Note";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === "partner" && (
            <div>
              <BaseLabel htmlFor="partner-name">Title</BaseLabel>
              <BaseInput
                id="partner-name"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                required
                placeholder="Release note title"
              />
            </div>
          )}
          <div>
            <BaseLabel htmlFor="note-content">{type === "partner" ? "Description" : "Note"}</BaseLabel>
            <BaseTextarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder={type === "partner" ? "Release note description..." : "Enter your note..."}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !content ||
                (type === "partner" && !partnerName) ||
                isSubmitting
              }
            >
              Add Note
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AddNoteDialog };
export type { AddNoteDialogProps, NoteFormData };
