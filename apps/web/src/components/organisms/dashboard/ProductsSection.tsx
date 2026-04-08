"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { ProductsFilterBar } from "./ProductsFilterBar";
import { useProducts } from "@/hooks/queries/useProducts";
import { useProductRoleFilters } from "@/hooks/utils/useProductRoleFilters";
import { PRODUCT_STAGES, type ProductStage } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import {
  FolderKanban,
  Plus,
  Loader2,
  LayoutGrid,
  List,
} from "lucide-react";

interface ProductsSectionProps {
  filterProductIds?: Set<string>;
}

export function ProductsSection({ filterProductIds }: ProductsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: allProducts = [], isLoading } = useProducts();
  const products = filterProductIds
    ? allProducts.filter((p) => filterProductIds.has(p.id))
    : allProducts;
  const { roleFilters, anyActive: anyRoleActive, matchesProduct, reset: resetRoles } =
    useProductRoleFilters();

  const stages = [...PRODUCT_STAGES];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || product.status === statusFilter;
    const matchesPillar =
      pillarFilter === "all" || product.pillar === pillarFilter;
    const matchesStage =
      stageFilter === "all" || product.stage === stageFilter;
    return matchesSearch && matchesStatus && matchesPillar && matchesStage && matchesProduct(product.id);
  });

  const hasActiveFilters =
    statusFilter !== "all" ||
    pillarFilter !== "all" ||
    stageFilter !== "all" ||
    searchQuery !== "" ||
    anyRoleActive;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPillarFilter("all");
    setStageFilter("all");
    resetRoles();
  };

  return (
    <div
      className="space-y-3 animate-fade-in"
      style={{ animationDelay: "250ms" }}
    >
      <SectionHeader
        filteredCount={filteredProducts.length}
        totalCount={products.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

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
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Loading projects...</p>
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && viewMode === "list" && (
        <div className="flex flex-col gap-1.5">
          {filteredProducts.map((product, index) => (
            <ProjectCard key={product.id} product={product} index={index} />
          ))}
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && viewMode === "grid" && (
        <div className="space-y-5">
          {stages
            .filter((stage) => filteredProducts.some((p) => (p.stage || "Intake") === stage))
            .map((stage) => (
              <div key={stage}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-bold text-foreground">{stage}</h2>
                  <Badge variant="secondary" className="text-sm font-mono font-semibold px-2.5 py-1">
                    {filteredProducts.filter((p) => (p.stage || "Intake") === stage).length}
                  </Badge>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts
                    .filter((p) => (p.stage || "Intake") === stage)
                    .map((product, index) => (
                      <ProjectCard key={product.id} product={product} index={index} />
                    ))}
                </div>
              </div>
            ))}
          {filteredProducts.some((p) => !stages.includes((p.stage || "Intake") as ProductStage)) && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-bold text-foreground">Other</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts
                  .filter((p) => !stages.includes((p.stage || "Intake") as ProductStage))
                  .map((product, index) => (
                    <ProjectCard key={product.id} product={product} index={index} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && filteredProducts.length === 0 && (
        <EmptyState
          hasProducts={products.length > 0}
          onClearFilters={clearFilters}
        />
      )}
    </div>
  );
}

function SectionHeader({
  filteredCount,
  totalCount,
  viewMode,
  onViewModeChange,
}: {
  filteredCount: number;
  totalCount: number;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">All Projects</h2>
        <Badge variant="secondary" className="font-mono text-xs">
          {filteredCount}
          {filteredCount !== totalCount && ` / ${totalCount}`}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-lg">
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="icon"
          className={cn(
            "h-7 w-7 transition-all",
            viewMode === "grid" && "shadow-sm",
          )}
          onClick={() => onViewModeChange("grid")}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="icon"
          className={cn(
            "h-7 w-7 transition-all",
            viewMode === "list" && "shadow-sm",
          )}
          onClick={() => onViewModeChange("list")}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ProjectCard({ product, index }: { product: { id: string; name: string; stage?: string | null; progress?: number | null; health_score?: number | null }; index: number }) {
  return (
    <Link
      href={`/projects/${product.id}`}
      className={cn(
        "group block relative overflow-hidden bg-card rounded-lg border border-l-[3px] p-3",
        "transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5",
      )}
      style={{
        opacity: 0,
        animation: `fade-in 0.3s ease-out ${Math.min(index * 50, 400)}ms forwards`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-foreground/90 transition-colors">
          {product.name}
        </h3>
        <span className="text-sm font-mono font-bold text-foreground tabular-nums flex-shrink-0">
          {product.health_score ?? 0}
        </span>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground font-medium">
            {product.stage || "Unknown"}
          </span>
          <span className="font-mono text-foreground tabular-nums">
            {product.progress ?? 0}%
          </span>
        </div>
        <div className="h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${product.progress ?? 0}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function EmptyState({
  hasProducts,
  onClearFilters,
}: {
  hasProducts: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
        <FolderKanban className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {hasProducts ? "No matching projects" : "No projects yet"}
      </h3>
      <p className="text-xs text-muted-foreground mb-3 max-w-sm">
        {hasProducts
          ? "Try adjusting your search or filter criteria"
          : "Create your first project to get started with lifecycle management"}
      </p>
      {hasProducts ? (
        <Button variant="outline" onClick={onClearFilters}>
          Clear Filters
        </Button>
      ) : (
        <Link href="/intake">
          <Button className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </Link>
      )}
    </div>
  );
}
