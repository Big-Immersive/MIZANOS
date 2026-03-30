"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { useUpdateProduct } from "@/hooks/mutations/useProductMutations";
import { PRODUCT_STAGES } from "@/lib/constants";
import type { ProductStage } from "@/lib/constants";
import { ArrowRight, Check, Clock } from "lucide-react";

interface StageProgressProps {
  currentStage: string;
  productId: string;
  suggestedStage?: ProductStage | null;
  canChangeStage?: boolean;
}

export function StageProgress({ currentStage, productId, suggestedStage, canChangeStage = false }: StageProgressProps) {
  const updateProduct = useUpdateProduct();
  const stageIndex = PRODUCT_STAGES.indexOf(currentStage as ProductStage);
  const [pendingStage, setPendingStage] = useState<ProductStage | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const confirmStage = (stage: ProductStage) => {
    updateProduct.mutate(
      { id: productId, stage },
      { onSuccess: () => setPendingStage(null) },
    );
  };

  const showSuggestion = canChangeStage && suggestedStage && !dismissed && !pendingStage
    && suggestedStage !== currentStage
    && PRODUCT_STAGES.indexOf(suggestedStage) > stageIndex;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stage Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {showSuggestion && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20 mb-2">
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-foreground flex-1">
              Tasks suggest <span className="font-medium">{suggestedStage}</span>
            </span>
            <BaseButton size="sm" className="h-6 text-xs px-2" onClick={() => confirmStage(suggestedStage)}>
              Advance
            </BaseButton>
            <BaseButton size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setDismissed(true)}>
              Dismiss
            </BaseButton>
          </div>
        )}

        {pendingStage && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-secondary border mb-2">
            <span className="text-xs text-foreground flex-1">
              Move to <span className="font-medium">{pendingStage}</span>?
            </span>
            <BaseButton
              size="sm"
              className="h-6 text-xs px-2"
              disabled={updateProduct.isPending}
              onClick={() => confirmStage(pendingStage)}
            >
              {updateProduct.isPending ? "Saving..." : "Confirm"}
            </BaseButton>
            <BaseButton size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setPendingStage(null)}>
              Cancel
            </BaseButton>
          </div>
        )}

        {PRODUCT_STAGES.map((stage, i) => {
          const isOnHold = currentStage === "On Hold";
          const isComplete = !isOnHold && stageIndex >= 0 && i < stageIndex;
          const isCurrent = stage === currentStage;
          return (
            <div
              key={stage}
              className={`flex items-center gap-3 p-1.5 rounded-md transition-colors ${
                canChangeStage ? "cursor-pointer hover:bg-accent/50" : ""
              }`}
              onClick={() => {
                if (!canChangeStage || stage === currentStage || pendingStage) return;
                setPendingStage(stage);
              }}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "bg-secondary text-secondary-foreground ring-2 ring-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`text-sm flex-1 ${
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {stage}
              </span>
              {isCurrent && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Clock className="h-3 w-3" />
                  Current
                </span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
