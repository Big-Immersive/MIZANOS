"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { useUpdateProduct } from "@/hooks/mutations/useProductMutations";
import { Calendar, Clock } from "lucide-react";
import type { Product } from "@/lib/types";

interface ProjectTimelineCardProps {
  product: Product;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not set";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getDaysRemaining(endDate: string | null): { days: number; percent: number } | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return { days, percent: 0 };
}

function getProgress(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function ProjectTimelineCard({ product }: ProjectTimelineCardProps) {
  const updateProduct = useUpdateProduct();
  const remaining = getDaysRemaining(product.end_date);
  const progress = getProgress(product.start_date, product.end_date);

  const handleDateChange = (field: "start_date" | "end_date", value: string) => {
    updateProduct.mutate({ id: product.id, [field]: value || null });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Project Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Created</span>
          <span className="tabular-nums text-xs">{formatDate(product.created_at)}</span>
        </div>

        <div className="flex justify-between text-sm items-center">
          <span className="text-muted-foreground">Start Date</span>
          <BaseInput
            type="date"
            className="w-[140px] h-7 text-xs"
            value={product.start_date?.slice(0, 10) ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDateChange("start_date", e.target.value)}
          />
        </div>

        <div className="flex justify-between text-sm items-center">
          <span className="text-muted-foreground">End Date</span>
          <BaseInput
            type="date"
            className="w-[140px] h-7 text-xs"
            value={product.end_date?.slice(0, 10) ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDateChange("end_date", e.target.value)}
          />
        </div>

        {product.start_date && product.end_date && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Timeline Progress</span>
                <span className="font-mono font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    remaining && remaining.days < 0 ? "bg-red-500" :
                    remaining && remaining.days <= 7 ? "bg-amber-500" :
                    "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>

            {remaining && (
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3" />
                {remaining.days < 0 ? (
                  <span className="text-red-500 font-medium">Overdue by {Math.abs(remaining.days)} days</span>
                ) : remaining.days === 0 ? (
                  <span className="text-amber-500 font-medium">Due today</span>
                ) : (
                  <span className={remaining.days <= 7 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                    {remaining.days} days remaining
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
