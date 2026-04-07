"use client";

import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/atoms/inputs/SearchableSelect";
import { Button } from "@/components/molecules/buttons/Button";
import { cn } from "@/lib/utils/cn";
import type { ProfileSummary } from "@/lib/types";
import { Search, Filter, X, User } from "lucide-react";
import { useMemo } from "react";

interface RoleFilterConfig {
  value: string;
  onChange: (v: string) => void;
  label: string;
  profiles: ProfileSummary[];
}

interface ProductsFilterBarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  pillarFilter: string;
  onPillarChange: (v: string) => void;
  stageFilter: string;
  onStageChange: (v: string) => void;
  stages: string[];
  roleFilters: RoleFilterConfig[];
  myProjectsActive?: boolean;
  onMyProjectsToggle?: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const STATUS_OPTIONS: SearchableSelectOption[] = [
  { value: "all", label: "All Status" },
  { value: "healthy", label: "Healthy" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const VERTICAL_OPTIONS: SearchableSelectOption[] = [
  { value: "all", label: "All Verticals" },
  { value: "business", label: "Business" },
  { value: "marketing", label: "Marketing" },
  { value: "development", label: "Development" },
  { value: "product", label: "Product" },
];

function buildStageOptions(stages: string[]): SearchableSelectOption[] {
  return [
    { value: "all", label: "All Stages" },
    ...stages.map((s) => ({ value: s, label: s })),
  ];
}

function buildRoleOptions(
  label: string,
  profiles: ProfileSummary[],
): SearchableSelectOption[] {
  const sorted = [...profiles].sort((a, b) => {
    const nameA = (a.full_name ?? a.email ?? "").toLowerCase();
    const nameB = (b.full_name ?? b.email ?? "").toLowerCase();
    return nameA.localeCompare(nameB);
  });
  return [
    { value: "all", label: `All ${label}s` },
    ...sorted.map((p) => ({
      value: p.id,
      label: p.full_name ?? p.email ?? "Unknown",
    })),
  ];
}

export function ProductsFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  pillarFilter,
  onPillarChange,
  stageFilter,
  onStageChange,
  stages,
  roleFilters,
  myProjectsActive,
  onMyProjectsToggle,
  hasActiveFilters,
  onClearFilters,
}: ProductsFilterBarProps) {
  const stageOptions = useMemo(() => buildStageOptions(stages), [stages]);

  return (
    <>
      <div className="relative flex-1 min-w-[160px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <BaseInput
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onSearchChange(e.target.value)
          }
          className="pl-9 bg-card"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {onMyProjectsToggle && (
        <Button
          variant={myProjectsActive ? "default" : "outline"}
          size="sm"
          onClick={onMyProjectsToggle}
          className="text-xs shrink-0"
        >
          <User className="h-3 w-3 mr-1" /> My Projects
        </Button>
      )}

      <SearchableSelect
        value={statusFilter}
        onValueChange={onStatusChange}
        options={STATUS_OPTIONS}
        placeholder="Status"
        icon={<Filter className="h-4 w-4 text-muted-foreground" />}
        triggerClassName={cn(
          "w-[130px] shrink-0 bg-card",
          statusFilter !== "all" && "border-primary/30",
        )}
      />
      <SearchableSelect
        value={pillarFilter}
        onValueChange={onPillarChange}
        options={VERTICAL_OPTIONS}
        placeholder="Vertical"
        triggerClassName={cn(
          "w-[130px] shrink-0 bg-card",
          pillarFilter !== "all" && "border-primary/30",
        )}
      />
      <SearchableSelect
        value={stageFilter}
        onValueChange={onStageChange}
        options={stageOptions}
        placeholder="Stage"
        triggerClassName={cn(
          "w-[130px] shrink-0 bg-card",
          stageFilter !== "all" && "border-primary/30",
        )}
      />
      {roleFilters.map((rf) => (
        <SearchableSelect
          key={rf.label}
          value={rf.value}
          onValueChange={rf.onChange}
          options={buildRoleOptions(rf.label, rf.profiles)}
          placeholder={rf.label}
          triggerClassName={cn(
            "w-[150px] shrink-0 bg-card",
            rf.value !== "all" && "border-primary/30",
          )}
        />
      ))}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </>
  );
}
