"use client";

import { ProductRow } from "@/components/molecules/product/ProductRow";
import type { Product } from "@/lib/types";

interface ProductTableProps {
  products: Product[];
  pmNameMap?: Map<string, string>;
}

const COLUMNS = [
  { label: "Project", className: "flex-1" },
  { label: "Status", className: "w-[90px]" },
  { label: "Vertical", className: "w-[100px]" },
  { label: "Stage", className: "w-[90px]" },
  { label: "PM", className: "w-[120px]" },
  { label: "Tasks", className: "w-[50px] text-right" },
  { label: "Bugs", className: "w-[60px] text-right" },
  { label: "Progress", className: "w-[100px]" },
  { label: "Health", className: "w-[50px] text-right" },
] as const;

function ProductTable({ products, pmNameMap }: ProductTableProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 bg-secondary/50 rounded-t-lg">
        {COLUMNS.map((col) => (
          <span
            key={col.label}
            className={`text-xs font-medium text-muted-foreground ${col.className}`}
          >
            {col.label}
          </span>
        ))}
      </div>

      <div className="divide-y">
        {products.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            taskCount={product.task_count ?? 0}
            pmName={pmNameMap?.get(product.id)}
          />
        ))}
      </div>
    </div>
  );
}

export { ProductTable };
export type { ProductTableProps };
