"use client";

import { useState } from "react";
import { Globe, Share2, Key, CheckSquare, ListTodo } from "lucide-react";
import type { MarketingDomain, MarketingSocialHandle, MarketingCredential, MarketingChecklistItem } from "@/lib/types/marketing";
import {
  useMarketingDomains,
  useMarketingSocialHandles,
  useMarketingCredentials,
  useMarketingChecklist,
} from "@/hooks/queries/useMarketingAssets";
import { DomainsSection } from "./DomainsSection";
import { SocialHandlesSection } from "./SocialHandlesSection";
import { CredentialsSection } from "./CredentialsSection";
import { ChecklistSection } from "./ChecklistSection";
import { MarketingTasksSection } from "./MarketingTasksSection";

interface MarketingTabProps {
  productId: string;
  canViewCredentials?: boolean;
}

const TABS = [
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "domains", label: "Domains", icon: Globe },
  { id: "social", label: "Social Handles", icon: Share2 },
  { id: "credentials", label: "Credentials", icon: Key },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function MarketingTab({ productId, canViewCredentials = false }: MarketingTabProps) {
  const [activeTab, setActiveTab] = useState<TabId>("tasks");
  const { data: domains, isLoading: domainsLoading } = useMarketingDomains(productId);
  const { data: socialHandles, isLoading: socialsLoading } = useMarketingSocialHandles(productId);
  const { data: credentials, isLoading: credentialsLoading } = useMarketingCredentials(productId);
  const { data: checklistItems, isLoading: checklistLoading } = useMarketingChecklist(productId);
  const isLoading = domainsLoading || socialsLoading || credentialsLoading || checklistLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Marketing Assets</h2>
        <p className="text-sm text-muted-foreground">
          Manage domains, social handles, credentials, and marketing checklist
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          if (tab.id === "credentials" && !canViewCredentials) return null;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading marketing assets...</div>
      ) : (
        <div className="min-h-[200px]">
          {activeTab === "tasks" && (
            <MarketingTasksSection productId={productId} />
          )}
          {activeTab === "domains" && (
            <DomainsSection domains={domains ?? []} productId={productId} />
          )}
          {activeTab === "social" && (
            <SocialHandlesSection handles={socialHandles ?? []} productId={productId} />
          )}
          {activeTab === "credentials" && canViewCredentials && (
            <CredentialsSection credentials={credentials ?? []} productId={productId} />
          )}
          {activeTab === "checklist" && (
            <ChecklistSection items={checklistItems ?? []} productId={productId} />
          )}
        </div>
      )}
    </div>
  );
}
