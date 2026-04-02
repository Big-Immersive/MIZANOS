"use client";

import { useMemo } from "react";
import { MizanLogo } from "@/components/atoms/brand/MizanLogo";
import { BaseSwitch } from "@/components/atoms/inputs/BaseSwitch";
import { PageHeader } from "@/components/molecules/layout/PageHeader";
import { QuickStats } from "@/components/organisms/dashboard/QuickStats";
import { ActionItems } from "@/components/organisms/dashboard/ActionItems";
import { ProductionHealth } from "@/components/organisms/dashboard/ProductionHealth";
import { StageChart } from "@/components/organisms/dashboard/StageChart";
import { RecentActivity } from "@/components/organisms/dashboard/RecentActivity";
import { ProductsSection } from "@/components/organisms/dashboard/ProductsSection";
import { ReportsSummaryCard } from "@/components/organisms/dashboard/ReportsSummaryCard";
import { useProducts } from "@/hooks/queries/useProducts";
import { useMyDashboard } from "@/hooks/utils/useMyDashboard";
import { FloatingAIButton } from "@/components/organisms/ai/FloatingAIButton";

export default function DashboardPage() {
  const { enabled: myDashboard, toggle, myProductIds } = useMyDashboard();
  const { data: products = [] } = useProducts();

  const filteredProducts = useMemo(() => {
    if (!myProductIds) return products;
    return products.filter((p) => myProductIds.has(p.id));
  }, [products, myProductIds]);

  const stageDistribution = useMemo(() => {
    const source = myProductIds ? filteredProducts : products;
    const map: Record<string, number> = {};
    for (const p of source) {
      const stage = p.stage || "Unknown";
      map[stage] = (map[stage] || 0) + 1;
    }
    return Object.entries(map).map(([stage, count]) => ({ stage, count }));
  }, [myProductIds, filteredProducts, products]);

  const quickStats = useMemo(() => {
    const source = myProductIds ? filteredProducts : products;
    const total = source.length;
    const healthy = source.filter((p) => p.stage === "Complete").length;
    const deployment = source.filter((p) => p.stage === "Deployment").length;
    return { totalProducts: total, healthyCount: healthy, deploymentStageCount: deployment };
  }, [myProductIds, filteredProducts, products]);

  return (
    <div className="p-6 space-y-4 w-full">
      <PageHeader
        title="Dashboard"
        subtitle="Project health overview and key action points"
        icon={<MizanLogo size={22} className="text-primary" />}
      >
        <div className="flex items-center gap-2 select-none">
          <BaseSwitch checked={myDashboard} onCheckedChange={toggle} />
          <span className="text-xs text-muted-foreground cursor-pointer" onClick={toggle}>
            {myDashboard ? "My Projects" : "All Projects"}
          </span>
        </div>
      </PageHeader>

      <QuickStats
        totalProducts={quickStats.totalProducts}
        healthyCount={quickStats.healthyCount}
        deploymentStageCount={quickStats.deploymentStageCount}
        filterProductIds={myProductIds}
      />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-1 min-w-0 animate-fade-in"
          style={{ animationDelay: "100ms" }}
        >
          <ActionItems filterProductIds={myProductIds} />
        </div>

        <div
          className="lg:col-span-1 min-w-0 animate-fade-in"
          style={{ animationDelay: "150ms" }}
        >
          <ProductionHealth filterProductIds={myProductIds} />
        </div>

        <div
          className="lg:col-span-1 min-w-0 space-y-4 animate-fade-in"
          style={{ animationDelay: "200ms" }}
        >
          <StageChart data={stageDistribution} />
          <RecentActivity filterProductIds={myProductIds} />
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
        <ReportsSummaryCard />
      </div>

      <ProductsSection filterProductIds={myProductIds} />
      <FloatingAIButton productName="All Projects" />
    </div>
  );
}
