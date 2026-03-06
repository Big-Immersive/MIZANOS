"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { Product } from "@/lib/types";
import { Bug, ClipboardList, UserCircle } from "lucide-react";

interface ProductCardProps {
  product: Product;
  taskCount?: number;
  pmName?: string;
}

function ProductCard({ product, taskCount = 0, pmName }: ProductCardProps) {
  const progress = product.progress ?? 0;

  return (
    <Link
      href={`/projects/${product.id}`}
      className={cn(
        "group block bg-card rounded-lg border p-4",
        "transition-colors duration-150 hover:bg-accent/50",
      )}
    >
      <h3 className="text-sm font-medium text-foreground truncate mb-2">
        {product.name}
      </h3>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>{product.stage || "No stage"}</span>
        <span className="font-mono tabular-nums">{progress}%</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ClipboardList className="h-3 w-3" />
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </span>
        {(product.bug_count ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Bug className="h-3 w-3" />
            {product.bugs_fixed_count ?? 0}/{product.bug_count} fixed
          </span>
        )}
        {pmName && (
          <span className="flex items-center gap-1 truncate">
            <UserCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{pmName}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

export { ProductCard };
export type { ProductCardProps };
