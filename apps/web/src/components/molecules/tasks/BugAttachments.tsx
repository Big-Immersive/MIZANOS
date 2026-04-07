"use client";

import { useRef, useState } from "react";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { useTaskAttachments } from "@/hooks/queries/useTaskAttachments";
import {
  useUploadAttachment,
  useDeleteAttachment,
} from "@/hooks/mutations/useTaskAttachmentMutations";
import { Paperclip, Upload, Trash2, Download, FileText, ImageIcon, Eye, X } from "lucide-react";

interface BugAttachmentsProps {
  taskId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(fileType: string): boolean {
  return fileType.startsWith("image/");
}

function getDownloadUrl(filePath: string): string {
  if (filePath.startsWith("http")) return filePath;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4006";
  return `${base}${filePath.startsWith("/") ? "" : "/"}${filePath}`;
}

async function forceDownload(url: string, fileName: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function BugAttachments({ taskId }: BugAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: attachments = [], isLoading } = useTaskAttachments(taskId);
  const uploadMutation = useUploadAttachment(taskId);
  const deleteMutation = useDeleteAttachment(taskId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const images = attachments.filter((a) => isImage(a.file_type));
  const files = attachments.filter((a) => !isImage(a.file_type));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground">({attachments.length})</span>
          )}
        </span>
        <BaseButton
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="text-xs h-7"
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploadMutation.isPending ? "Uploading..." : "Upload"}
        </BaseButton>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
          onChange={handleFileSelect}
        />
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}

      {images.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> Images
          </p>
          <div className="flex gap-2 flex-wrap">
            {images.map((att) => {
              const url = getDownloadUrl(att.file_path);
              return (
                <div
                  key={att.id}
                  className="relative group rounded-md border overflow-hidden w-24 h-24 shrink-0 bg-secondary/30"
                >
                  <img src={url} alt={att.file_name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setPreviewUrl(url); setPreviewName(att.file_name); }}
                      className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => forceDownload(url, att.file_name)}
                      className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(att.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-full bg-white/20 hover:bg-red-500/80 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1 py-0.5 truncate">
                    {att.file_name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Files
          </p>
          <div className="space-y-1">
            {files.map((att) => {
              const url = getDownloadUrl(att.file_path);
              return (
                <div key={att.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
                  <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="flex-1 truncate font-medium">{att.file_name}</span>
                  <span className="text-muted-foreground shrink-0">{formatSize(att.file_size)}</span>
                  <button
                    type="button"
                    onClick={() => forceDownload(url, att.file_name)}
                    className="text-primary hover:text-primary/80 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(att.id)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive/80 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-white/80 flex items-center gap-1 text-sm"
            >
              <X className="h-4 w-4" /> Close
            </button>
            <img
              src={previewUrl}
              alt={previewName}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            <p className="text-center text-white text-xs mt-2 opacity-70">{previewName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
