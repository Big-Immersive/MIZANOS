"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/display/Card";
import { Button } from "@/components/molecules/buttons/Button";
import { Skeleton } from "@/components/atoms/display/Skeleton";
import {
  GitBranch,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { specificationsRepository } from "@/lib/api/repositories";
import { toast } from "sonner";
import { useProductDetail } from "@/hooks/queries/useProductDetail";
import { useSpecificationSources } from "@/hooks/queries/useSpecificationSources";
import { useRegenerateSpecification } from "@/hooks/mutations/useSpecificationMutations";
import { AddSourceDialog } from "./AddSourceDialog";
import { SourceCard, type SpecSource } from "./SourceCard";
import type { JsonValue } from "@/lib/types";

export interface SourcesTabProps {
  productId: string;
}

export function SourcesTab({ productId }: SourcesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const { data, isLoading: productLoading } = useProductDetail(productId);
  const { data: specSources, isLoading: sourcesLoading } = useSpecificationSources(productId);
  const regenerate = useRegenerateSpecification(productId);
  const product = data?.product;

  const sources: SpecSource[] = (specSources ?? []).map((s) => ({
    id: s.id,
    source_type: s.source_type,
    file_name: s.file_name,
    file_url: s.file_url,
    url: s.url,
    raw_content: s.raw_content,
    transcription: s.transcription,
    ai_summary: s.ai_summary as Record<string, JsonValue> | null,
    logo_url: s.logo_url ?? null,
    screenshots: s.screenshots as Record<string, JsonValue> | null,
    branding: s.branding as Record<string, JsonValue> | null,
    created_at: s.created_at,
  }));

  const isLoading = productLoading || sourcesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project Sources</h2>
          <p className="text-sm text-muted-foreground">
            Documents, websites, audio notes, and repositories used during intake
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setEnriching(true);
              try {
                const result = await specificationsRepository.enrichAllSources(productId);
                toast.success(result.message);
                if (result.enriched > 0) window.location.reload();
              } catch { toast.error("Enrichment failed"); }
              finally { setEnriching(false); }
            }}
            disabled={enriching}
          >
            {enriching ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Enrich All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerate.mutate(undefined)}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Regenerate Spec
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Source
          </Button>
        </div>
      </div>

      {product?.repository_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              GitHub Repository
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <a
                href={product.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {product.repository_url}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {sources.length > 0 ? (
        <div className="space-y-3">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="font-medium">No intake sources recorded</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sources are captured during the intake process
            </p>
          </CardContent>
        </Card>
      )}

      <AddSourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={productId}
      />
    </div>
  );
}
