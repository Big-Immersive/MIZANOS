"use client";

import { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Pencil, Eye, Settings, Archive } from "lucide-react";

import { EditableTitle } from "@/components/atoms/inputs/EditableTitle";
import { ProductTabs } from "@/components/organisms/product/ProductTabs";
import { ProductTeamTab } from "@/components/organisms/product/ProductTeamTab";
import { ProductOverview } from "@/components/organisms/product/ProductOverview";
import { SpecViewer } from "@/components/organisms/product/SpecViewer";
import { SpecEditor } from "@/components/organisms/product/SpecEditor";
import { TasksViewToggle } from "@/components/organisms/product/TasksViewToggle";
import { DocumentsList } from "@/components/organisms/product/DocumentsList";
import { DocumentUpload } from "@/components/organisms/product/DocumentUpload";
import { AuditHistoryList } from "@/components/organisms/product/AuditHistoryList";
import { DeploymentChecklist } from "@/components/organisms/product/DeploymentChecklist";
import { ProjectLinksSection } from "@/components/organisms/product/ProjectLinksSection";
import { GoLiveChecklist } from "@/components/organisms/product/GoLiveChecklist";
import { ProjectIntegrations } from "@/components/organisms/product/ProjectIntegrations";
import { EnvironmentsTab } from "@/components/organisms/product/EnvironmentsTab";
import { MarketingTab } from "@/components/organisms/marketing/MarketingTab";
import { SourcesTab } from "@/components/organisms/product/SourcesTab";
import { BugsTab } from "@/components/organisms/product/BugsTab";
import { QAChecklistTab } from "@/components/organisms/product/QAChecklistTab";
import { ProductSettingsDialog } from "@/components/organisms/product/ProductSettingsDialog";
import { LinkGitHubDialog } from "@/components/organisms/product/LinkGitHubDialog";
import { GitHubLinkBanner } from "@/components/molecules/github/GitHubLinkBanner";
import { Dialog, DialogContent, DialogTitle } from "@/components/atoms/layout/Dialog";
import { Button } from "@/components/molecules/buttons/Button";
import { useProductDetail } from "@/hooks/queries/useProductDetail";
import { useUpdateProduct } from "@/hooks/mutations/useProductMutations";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { data: product, isLoading } = useProductDetail(id);
  const updateProduct = useUpdateProduct();
  const { canEditProduct } = useRoleVisibility();
  const [specEditing, setSpecEditing] = useState(false);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkGitHubOpen, setLinkGitHubOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const tabParam = searchParams.get("tab");
  const taskParam = searchParams.get("task");

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <p className="text-muted-foreground mt-2">The requested project does not exist.</p>
      </div>
    );
  }

  const specContent = (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={() => setSpecEditing(!specEditing)}>
          {specEditing ? <><Eye className="h-4 w-4 mr-1" /> View</> : <><Pencil className="h-4 w-4 mr-1" /> Edit</>}
        </Button>
      </div>
      {specEditing
        ? <SpecEditor productId={id} />
        : <SpecViewer productId={id} productName={product.product?.name ?? "Product"} />}
    </div>
  );

  const documentsContent = (
    <>
      <DocumentsList productId={id} onUploadClick={() => setDocUploadOpen(true)} />
      <Dialog open={docUploadOpen} onOpenChange={setDocUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="sr-only">Upload Document</DialogTitle>
          <DocumentUpload productId={id} onComplete={() => setDocUploadOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );

  const productData = product.product;
  const isArchived = !!productData?.archived_at;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        {canEditProduct && !isArchived ? (
          <EditableTitle
            value={productData?.name ?? "Project"}
            onSave={(name) => updateProduct.mutate({ id, name })}
            isLoading={updateProduct.isPending}
          />
        ) : (
          <h1 className="text-2xl font-semibold">{productData?.name ?? "Project"}</h1>
        )}
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4 mr-1" /> Settings
        </Button>
      </div>
      {isArchived && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">This product is archived</p>
              <p className="text-xs text-amber-600">All content is read-only. Open Settings to restore.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-100" onClick={() => setSettingsOpen(true)}>
            Restore
          </Button>
        </div>
      )}
      {!isArchived && (
        <GitHubLinkBanner
          repositoryUrl={productData?.repository_url ?? null}
          repoStatus={productData?.github_repo_status ?? null}
          repoError={productData?.github_repo_error ?? null}
          trackedBranch={productData?.tracked_branch ?? null}
          onLinkClick={() => setLinkGitHubOpen(true)}
        />
      )}
      <ProductTabs
        productId={id}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isArchived={isArchived}
        overviewContent={<ProductOverview productId={id} />}
        teamContent={<ProductTeamTab productId={id} />}
        specContent={specContent}
        tasksContent={<TasksViewToggle productId={id} openTaskId={taskParam ?? undefined} />}
        bugsContent={<BugsTab productId={id} />}
        documentsContent={documentsContent}
        auditContent={<AuditHistoryList productId={id} />}
        deploymentContent={
          <div className="space-y-6">
            <ProjectLinksSection productId={id} />
            <DeploymentChecklist productId={id} />
            <GoLiveChecklist productId={id} />
            <ProjectIntegrations productId={id} />
          </div>
        }
        environmentsContent={<EnvironmentsTab productId={id} />}
        marketingContent={<MarketingTab productId={id} canViewCredentials />}
        qaContent={<QAChecklistTab productId={id} />}
        sourcesContent={<SourcesTab productId={id} />}
      />
      <LinkGitHubDialog
        open={linkGitHubOpen}
        onOpenChange={setLinkGitHubOpen}
        productId={id}
        currentUrl={productData?.repository_url}
        currentPatId={productData?.github_pat_id}
        currentBranch={productData?.tracked_branch}
      />
      {productData && (
        <ProductSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          product={productData}
          productId={id}
        />
      )}
    </div>
  );
}
