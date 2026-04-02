"use client";

import { ProjectChecklistView } from "./ProjectChecklistView";

interface QAChecklistTabProps {
  productId: string;
}

export function QAChecklistTab({ productId }: QAChecklistTabProps) {
  return <ProjectChecklistView productId={productId} checklistType="qa" title="QA Checklists" />;
}
