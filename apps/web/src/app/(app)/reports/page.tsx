"use client";

import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/molecules/layout/PageHeader";
import { ReportsOverview } from "@/components/organisms/reports/ReportsOverview";
import { ProjectReportsList } from "@/components/organisms/reports/ProjectReportsList";

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-4 w-full">
      <PageHeader
        title="Reports"
        subtitle="Project status, task progress, and development metrics"
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
      />
      <ReportsOverview />
      <ProjectReportsList />
    </div>
  );
}
