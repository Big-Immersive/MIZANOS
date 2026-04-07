"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { PageHeader } from "@/components/molecules/layout/PageHeader";
import { ProductCard } from "@/components/molecules/product/ProductCard";
import { ArchivedProductCard } from "@/components/molecules/product/ArchivedProductCard";
import { ProductTable } from "@/components/organisms/product/ProductTable";
import { ProductsFilterBar } from "@/components/organisms/dashboard/ProductsFilterBar";
import { useAuth } from "@/contexts/AuthContext";
import { useAllTasks } from "@/hooks/queries/useAllTasks";
import { useAllProductMembers } from "@/hooks/queries/useProductMembers";
import { useProducts } from "@/hooks/queries/useProducts";
import { useProfiles } from "@/hooks/queries/useProfiles";
import { useUnarchiveProduct } from "@/hooks/mutations/useProductMutations";
import { useProductRoleFilters } from "@/hooks/utils/useProductRoleFilters";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import { isMyDashboardEnabled, buildMyProjectIds } from "@/hooks/utils/useMyDashboard";
import { PRODUCT_STAGES, type ProductStage } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import {
  FolderKanban,
  Plus,
  Loader2,
  LayoutGrid,
  List,
  Archive,
} from "lucide-react";

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  useEffect(() => {
    setMyProjectsOnly(isMyDashboardEnabled());
  }, []);

  const { user } = useAuth();
  const { data: products = [], isLoading } = useProducts();
  const { data: allTasks = [] } = useAllTasks();
  const { roleFilters, anyActive: anyRoleActive, matchesProduct, reset: resetRoles } =
    useProductRoleFilters();
  const { data: allMembers = [] } = useAllProductMembers();
  const { data: profiles = [] } = useProfiles();
  const { isSuperAdmin, isProjectManager } = useRoleVisibility();
  const canCreateProject = isSuperAdmin || isProjectManager;
  const unarchiveProduct = useUnarchiveProduct();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = (productId: string) => {
    setRestoringId(productId);
    unarchiveProduct.mutate(productId, {
      onSettled: () => setRestoringId(null),
    });
  };

  const pmNameMap = useMemo(() => {
    const profileMap = new Map<string, string>();
    for (const p of profiles) profileMap.set(p.id, p.full_name ?? p.email ?? "Unknown");
    const map = new Map<string, string>();
    for (const m of allMembers) {
      if (m.role === "project_manager") {
        map.set(m.product_id, profileMap.get(m.profile_id) ?? "Unknown");
      }
    }
    return map;
  }, [allMembers, profiles]);

  const myProjectIds = useMemo(() => {
    const userId = user?.profile_id;
    if (!userId) return new Set<string>();
    return buildMyProjectIds(userId, allMembers, allTasks);
  }, [allMembers, allTasks, user?.profile_id]);

  const archivedCount = products.filter((p) => p.archived_at).length;

  const activeProducts = showArchived
    ? products.filter((p) => p.archived_at)
    : products.filter((p) => !p.archived_at);

  const stages = [...PRODUCT_STAGES];

  const filteredProducts = activeProducts.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const progress = product.progress ?? 0;
    const health = progress >= 80 ? "healthy" : progress >= 60 ? "warning" : "critical";
    const matchesStatus =
      statusFilter === "all" || health === statusFilter;
    const matchesPillar =
      pillarFilter === "all" || product.pillar === pillarFilter;
    const matchesStage =
      stageFilter === "all" || product.stage === stageFilter;
    const matchesMine = !myProjectsOnly || myProjectIds.has(product.id);
    return matchesSearch && matchesStatus && matchesPillar && matchesStage && matchesProduct(product.id) && matchesMine;
  });

  const hasActiveFilters =
    statusFilter !== "all" ||
    pillarFilter !== "all" ||
    stageFilter !== "all" ||
    searchQuery !== "" ||
    myProjectsOnly ||
    anyRoleActive;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPillarFilter("all");
    setStageFilter("all");
    setMyProjectsOnly(false);
    resetRoles();
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Projects"
        subtitle={showArchived ? "Click title to view all projects" : "All projects across your organization"}
        icon={<FolderKanban className="h-5 w-5 text-primary" />}
        onTitleClick={showArchived ? () => setShowArchived(false) : undefined}
        badge={
          <Badge variant="secondary" className="font-mono text-xs">
            {filteredProducts.length}
            {filteredProducts.length !== products.length &&
              ` / ${products.length}`}
          </Badge>
        }
      >
        {canCreateProject && (
          <Link href="/intake">
            <Button className="shadow-sm hover:shadow-md transition-shadow">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="flex items-center gap-2 flex-wrap">
        <ProductsFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          pillarFilter={pillarFilter}
          onPillarChange={setPillarFilter}
          stageFilter={stageFilter}
          onStageChange={setStageFilter}
          stages={stages}
          roleFilters={roleFilters}
          myProjectsActive={myProjectsOnly}
          onMyProjectsToggle={() => setMyProjectsOnly((v) => !v)}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
        {archivedCount > 0 && (
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-9 text-xs gap-1.5 transition-all shrink-0",
              showArchived
                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md border-amber-600"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? "Back to Projects" : `Archived (${archivedCount})`}
          </Button>
        )}
        <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-lg shrink-0">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className={cn("h-7 w-7 transition-all", viewMode === "list" && "shadow-sm")}
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className={cn("h-7 w-7 transition-all", viewMode === "grid" && "shadow-sm")}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Loading projects...</p>
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && viewMode === "grid" && showArchived && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-bold text-foreground">Archived Projects</h2>
            <Badge variant="secondary" className="text-sm font-mono font-semibold px-2.5 py-1">
              {filteredProducts.length}
            </Badge>
            <div className="flex-1 h-px bg-border" />
          </div>
          <p className="text-xs text-red-500">
            Archived projects are permanently deleted after 30 days.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ArchivedProductCard
                key={product.id}
                product={product}
                pmName={pmNameMap.get(product.id)}
                onRestore={handleRestore}
                isRestoring={restoringId === product.id}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && viewMode === "grid" && !showArchived && (
        <div className="space-y-6">
          {stages
            .filter((stage) => filteredProducts.some((p) => (p.stage || "Intake") === stage))
            .map((stage) => (
              <div key={stage}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-foreground">{stage}</h2>
                  <Badge variant="secondary" className="text-sm font-mono font-semibold px-2.5 py-1">
                    {filteredProducts.filter((p) => (p.stage || "Intake") === stage).length}
                  </Badge>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts
                    .filter((p) => (p.stage || "Intake") === stage)
                    .map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        taskCount={product.task_count ?? 0}
                        pmName={pmNameMap.get(product.id)}
                      />
                    ))}
                </div>
              </div>
            ))}
          {/* Projects with unrecognized stages */}
          {filteredProducts.some((p) => !stages.includes((p.stage || "Intake") as ProductStage)) && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-foreground">Other</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts
                  .filter((p) => !stages.includes((p.stage || "Intake") as ProductStage))
                  .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      taskCount={product.task_count ?? 0}
                      pmName={pmNameMap.get(product.id)}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && viewMode === "list" && (
        <ProductTable products={filteredProducts} pmNameMap={pmNameMap} />
      )}

      {!isLoading && filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
            <FolderKanban className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {products.length > 0 ? "No matching projects" : "No projects yet"}
          </h3>
          <p className="text-xs text-muted-foreground mb-3 max-w-sm">
            {products.length > 0
              ? "Try adjusting your search or filter criteria"
              : "Create your first project to get started with lifecycle management"}
          </p>
          {products.length > 0 ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          ) : canCreateProject ? (
            <Link href="/intake">
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
