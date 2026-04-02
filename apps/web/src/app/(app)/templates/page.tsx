"use client";

import { LayoutTemplate } from "lucide-react";
import { ChecklistTemplateSection } from "@/components/organisms/templates/ChecklistTemplateSection";
import { PageHeader } from "@/components/molecules/layout/PageHeader";

export default function TemplatesPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Templates"
        subtitle="Manage checklist templates for your projects"
        icon={<LayoutTemplate className="h-5 w-5 text-primary" />}
      />

      <ChecklistTemplateSection />
    </div>
  );
}
