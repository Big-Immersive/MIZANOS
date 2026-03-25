"use client";

import { useState } from "react";
import { BarChart3, FileDown } from "lucide-react";
import { PageHeader } from "@/components/molecules/layout/PageHeader";
import { BaseButton } from "@/components/atoms/buttons/BaseButton";
import { ReportsOverview } from "@/components/organisms/reports/ReportsOverview";
import { ProjectReportsList } from "@/components/organisms/reports/ProjectReportsList";
import { GenerateReportDialog } from "@/components/organisms/reports/GenerateReportDialog";
import { useReportsSummary } from "@/hooks/queries/useReports";

export default function ReportsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data } = useReportsSummary();

  return (
    <div className="p-6 space-y-4 w-full">
      <PageHeader
        title="Reports"
        subtitle="Project status, task progress, and development metrics"
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
      >
        <BaseButton onClick={() => setDialogOpen(true)} size="sm">
          <FileDown className="h-4 w-4 mr-2" />
          Generate Report
        </BaseButton>
      </PageHeader>
      <ReportsOverview />
      <ProjectReportsList />

      {data?.projects && (
        <GenerateReportDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          projects={data.projects}
        />
      )}
    </div>
  );
}
