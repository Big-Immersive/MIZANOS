"use client";

import { useParams } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/molecules/layout/PageHeader";
import { ProjectReportDetail } from "@/components/organisms/reports/ProjectReportDetail";

export default function ProjectReportPage() {
  const params = useParams<{ productId: string }>();

  return (
    <div className="p-6 space-y-4 w-full">
      <PageHeader
        title="Project Report"
        subtitle="Detailed project analysis and metrics"
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
      />
      <ProjectReportDetail productId={params.productId} />
    </div>
  );
}
