"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/atoms/layout/Tabs";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  FolderOpen,
  History,
  Rocket,
  Server,
  ShieldCheck,
  Megaphone,
  FolderGit2,
  Users,
  Bug,
  Code2,
} from "lucide-react";

interface ProductTabConfig {
  value: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  count?: number;
}

interface ProductTabsProps {
  productId: string;
  overviewContent?: ReactNode;
  teamContent?: ReactNode;
  specContent?: ReactNode;
  tasksContent?: ReactNode;
  bugsContent?: ReactNode;
  documentsContent?: ReactNode;
  auditContent?: ReactNode;
  deploymentContent?: ReactNode;
  qaContent?: ReactNode;
  devStandardsContent?: ReactNode;
  environmentsContent?: ReactNode;
  marketingContent?: ReactNode;
  sourcesContent?: ReactNode;
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isArchived?: boolean;
  className?: string;
}

function ProductTabs({
  productId,
  overviewContent,
  teamContent,
  specContent,
  tasksContent,
  bugsContent,
  documentsContent,
  auditContent,
  deploymentContent,
  qaContent,
  devStandardsContent,
  environmentsContent,
  marketingContent,
  sourcesContent,
  defaultTab = "overview",
  activeTab: controlledTab,
  onTabChange,
  isArchived,
  className,
}: ProductTabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab);
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;

  const tabs: ProductTabConfig[] = [
    {
      value: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
      content: overviewContent,
    },
    {
      value: "team",
      label: "Team",
      icon: <Users className="h-4 w-4" />,
      content: teamContent,
    },
    {
      value: "spec",
      label: "Specification",
      icon: <FileText className="h-4 w-4" />,
      content: specContent,
    },
    {
      value: "tasks",
      label: "Tasks",
      icon: <ClipboardCheck className="h-4 w-4" />,
      content: tasksContent,
    },
    {
      value: "bugs",
      label: "Bugs",
      icon: <Bug className="h-4 w-4" />,
      content: bugsContent,
    },
    {
      value: "documents",
      label: "Documents",
      icon: <FolderOpen className="h-4 w-4" />,
      content: documentsContent,
    },
    {
      value: "marketing",
      label: "Marketing",
      icon: <Megaphone className="h-4 w-4" />,
      content: marketingContent,
    },
    {
      value: "qa",
      label: "QA",
      icon: <ShieldCheck className="h-4 w-4" />,
      content: qaContent,
    },
    {
      value: "dev-standards",
      label: "Dev Standards",
      icon: <Code2 className="h-4 w-4" />,
      content: devStandardsContent,
    },
    {
      value: "audit",
      label: "Audit History",
      icon: <History className="h-4 w-4" />,
      content: auditContent,
    },
    {
      value: "deployment",
      label: "Deployment",
      icon: <Rocket className="h-4 w-4" />,
      content: deploymentContent,
    },
    {
      value: "environments",
      label: "Environments",
      icon: <Server className="h-4 w-4" />,
      content: environmentsContent,
    },
    {
      value: "sources",
      label: "Sources",
      icon: <FolderGit2 className="h-4 w-4" />,
      content: sourcesContent,
    },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={cn("w-full", className)}
    >
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="flex items-center gap-2"
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="text-[10px] tabular-nums bg-secondary px-1.5 py-0.5 rounded-md">
                {tab.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <div inert={isArchived || undefined} className={cn(isArchived && "opacity-60")}>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {tab.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

export { ProductTabs };
export type { ProductTabsProps, ProductTabConfig };
