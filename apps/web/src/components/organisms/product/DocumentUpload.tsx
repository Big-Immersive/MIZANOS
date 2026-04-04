"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { useUploadDocument } from "@/hooks/mutations/useDocumentMutations";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DocumentUploadProps {
  productId: string;
  folderId?: string | null;
  onComplete?: () => void;
}

interface QueuedFile {
  file: File;
  category: string;
  description: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const CATEGORIES = [
  "general",
  "design",
  "requirements",
  "screenshots",
  "contracts",
  "reports",
] as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentUpload({
  productId,
  folderId,
  onComplete,
}: DocumentUploadProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>("general");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const uploadMutation = useUploadDocument(productId);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const newFiles: QueuedFile[] = Array.from(files).map((file) => ({
        file,
        category: defaultCategory,
        description: "",
        status: "pending" as const,
      }));

      setQueue((prev) => [...prev, ...newFiles]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [defaultCategory],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const files = event.dataTransfer.files;
      const newFiles: QueuedFile[] = Array.from(files).map((file) => ({
        file,
        category: defaultCategory,
        description: "",
        status: "pending" as const,
      }));

      setQueue((prev) => [...prev, ...newFiles]);
    },
    [defaultCategory],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const removeFile = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileCategory = (index: number, category: string) => {
    setQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, category } : item)),
    );
  };

  const updateFileDescription = (index: number, description: string) => {
    setQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, description } : item)),
    );
  };

  const handleUploadAll = async () => {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status !== "pending") continue;

      if (item.file.size > MAX_FILE_SIZE) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? { ...q, status: "error" as const, error: "File too large (max 50MB)" }
              : q,
          ),
        );
        continue;
      }

      setQueue((prev) =>
        prev.map((q, idx) =>
          idx === i ? { ...q, status: "uploading" as const } : q,
        ),
      );

      try {
        await uploadMutation.mutateAsync(item.file);

        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: "done" as const } : q,
          ),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: "error" as const, error: message } : q,
          ),
        );
      }
    }
    onComplete?.();
  };

  const pendingCount = queue.filter((f) => f.status === "pending").length;
  const doneCount = queue.filter((f) => f.status === "done").length;

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Max 50MB per file. All common file types accepted.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Upload Queue ({doneCount}/{queue.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-background"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleUploadAll}
                  disabled={pendingCount === 0}
                  loading={uploadMutation.isPending}
                >
                  Upload All ({pendingCount})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                className="flex items-center gap-3 p-2 rounded-md border bg-background"
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.file.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)}
                    </span>
                    <select
                      value={item.category}
                      onChange={(e) =>
                        updateFileCategory(index, e.target.value)
                      }
                      className="text-xs border rounded px-1 py-0.5 bg-background"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="shrink-0">
                  {item.status === "done" && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {item.status === "error" && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  {item.status === "pending" && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 rounded hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                  {item.status === "uploading" && (
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { DocumentUpload };
export type { DocumentUploadProps };
