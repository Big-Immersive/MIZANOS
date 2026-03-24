"use client";

import { Sparkles, AlertTriangle, Lightbulb, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/atoms/display/Card";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { useTriggerAnalysis } from "@/hooks/mutations/useReportMutations";
import type { AIAnalysis } from "@/lib/types";

interface Props {
  productId: string;
  analysis: AIAnalysis | null;
}

export function AIAnalysisCard({ productId, analysis }: Props) {
  const { mutate, isPending } = useTriggerAnalysis();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pillar-marketing" />
            AI Analysis
          </CardTitle>
          <BaseButton
            variant="outline"
            size="sm"
            onClick={() => mutate(productId)}
            disabled={isPending}
            className="h-7 text-xs"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            {analysis ? "Refresh" : "Generate"}
          </BaseButton>
        </div>
      </CardHeader>
      <CardContent>
        {!analysis && !isPending && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Click &quot;Generate&quot; to create an AI-powered project analysis.
          </p>
        )}

        {isPending && !analysis && (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing project...
          </div>
        )}

        {analysis && (
          <div className="space-y-4">
            {/* Health assessment */}
            <div>
              <p className="text-sm leading-relaxed">{analysis.health_assessment}</p>
            </div>

            {/* Risk factors */}
            {analysis.risk_factors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-3 w-3 text-status-warning" />
                  Risk Factors
                </h4>
                <ul className="space-y-1">
                  {analysis.risk_factors.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-status-warning mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Lightbulb className="h-3 w-3 text-pillar-business" />
                  Recommendations
                </h4>
                <ul className="space-y-1">
                  {analysis.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-pillar-business mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dev summary */}
            {analysis.dev_contribution_summary && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  Development Progress
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {analysis.dev_contribution_summary}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
