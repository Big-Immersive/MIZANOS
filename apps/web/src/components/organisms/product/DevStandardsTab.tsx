"use client";

import { ProjectChecklistView } from "./ProjectChecklistView";

interface DevStandardsTabProps {
  productId: string;
}

export function DevStandardsTab({ productId }: DevStandardsTabProps) {
  return <ProjectChecklistView productId={productId} checklistType="development" title="Dev Standards" />;
}
