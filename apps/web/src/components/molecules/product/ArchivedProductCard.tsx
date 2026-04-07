"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { ArchiveRestore, Clock } from "lucide-react";
import type { Product } from "@/lib/types";

interface ArchivedProductCardProps {
  product: Product;
  pmName?: string;
  onRestore: (id: string) => void;
  isRestoring: boolean;
}

function getDaysRemaining(archivedAt: string | null): number {
  if (!archivedAt) return 0;
  const archived = new Date(archivedAt);
  const expiry = new Date(archived.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function ArchivedProductCard({
  product,
  pmName,
  onRestore,
  isRestoring,
}: ArchivedProductCardProps) {
  const daysLeft = getDaysRemaining(product.archived_at);

  return (
    <div
      className={cn(
        "group block bg-card rounded-lg border border-red-900/30 p-4",
        "transition-colors duration-150 hover:bg-accent/50 relative",
      )}
    >
      <Link href={`/projects/${product.id}`} className="block mb-3">
        <h3 className="text-sm font-medium text-foreground truncate mb-1">
          {product.name}
        </h3>
        <p className="text-xs text-muted-foreground">
          {product.stage || "No stage"}
          {pmName && ` · ${pmName}`}
        </p>
      </Link>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-red-500">
          <Clock className="h-3 w-3" />
          {daysLeft === 0
            ? "Deleting today"
            : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onRestore(product.id);
          }}
          disabled={isRestoring}
          className={cn(
            "flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md",
            "bg-emerald-600 hover:bg-emerald-700 text-white transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <ArchiveRestore className="h-3 w-3" />
          {isRestoring ? "Restoring..." : "Restore"}
        </button>
      </div>
    </div>
  );
}

export { ArchivedProductCard, getDaysRemaining };
export type { ArchivedProductCardProps };
