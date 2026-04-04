"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/display/Badge";
import { Button } from "@/components/molecules/buttons/Button";
import { Progress } from "@/components/atoms/feedback/Progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/atoms/feedback/Tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/atoms/layout/Collapsible";
import { CheckSquare, ChevronDown, Rocket, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { useChecklistMutations, useApplyTemplate } from "@/hooks/mutations/useMarketingMutations";
import { PHASE_KNOWLEDGE_MAP } from "@/lib/constants/knowledge";
import type { MarketingChecklistItem } from "@/lib/types/marketing";

interface ChecklistSectionProps {
  items: MarketingChecklistItem[];
  productId: string;
}

/** Group items by category, preserving order_index sort. */
function groupByCategory(items: MarketingChecklistItem[]) {
  const groups = new Map<string, MarketingChecklistItem[]>();
  for (const item of items) {
    const key = item.category || "Uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function PhaseProgress({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Progress value={pct} className="h-1.5 w-20" />
      <span>{completed}/{total}</span>
    </div>
  );
}

function ChecklistItem({
  item,
  onToggle,
}: {
  item: MarketingChecklistItem;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-start gap-3 rounded-lg border p-3 w-full text-left hover:bg-accent/50 transition-colors"
    >
      <div
        className={`mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center ${
          item.is_completed
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground"
        }`}
      >
        {item.is_completed && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={`text-sm ${
            item.is_completed ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {item.title}
        </span>
        {item.description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 cursor-help">
                {item.description}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs">{item.description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </button>
  );
}

function PhaseKnowledgeLink({ category }: { category: string }) {
  const articleTitle = PHASE_KNOWLEDGE_MAP[category];
  if (!articleTitle) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/knowledge?search=${encodeURIComponent(articleTitle)}`}
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:text-primary/80 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Read: {articleTitle}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ChecklistSection({ items, productId }: ChecklistSectionProps) {
  const { toggleItem } = useChecklistMutations(productId);
  const applyTemplate = useApplyTemplate(productId);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  if (items.length === 0) {
    return null;
  }

  const totalCompleted = items.filter((i) => i.is_completed).length;
  const totalPct = Math.round((totalCompleted / items.length) * 100);
  const groups = groupByCategory(items);
  const hasPhases = groups.size > 1;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Overall progress */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Progress value={totalPct} className="h-2 flex-1" />
            <Badge variant="secondary" className="text-xs shrink-0">
              {totalCompleted}/{items.length} completed
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/knowledge?category=gtm">
              <Button variant="ghost" size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                Launch Playbook
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyTemplate.mutate("product_hunt")}
              disabled={applyTemplate.isPending}
            >
              {applyTemplate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Apply Template
            </Button>
          </div>
        </div>

        {/* Phase-grouped items */}
        {hasPhases ? (
          Array.from(groups.entries()).map(([category, phaseItems]) => {
            const phaseCompleted = phaseItems.filter((i) => i.is_completed).length;
            const isOpen = expandedPhases.has(category);

            return (
              <Collapsible key={category} open={isOpen} onOpenChange={() => togglePhase(category)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border bg-muted/30 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                    <span className="text-sm font-medium">{category}</span>
                    <PhaseKnowledgeLink category={category} />
                  </div>
                  <PhaseProgress completed={phaseCompleted} total={phaseItems.length} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1.5 pt-1.5 pl-2">
                  {phaseItems.map((item) => (
                    <ChecklistItem
                      key={item.id}
                      item={item}
                      onToggle={() =>
                        toggleItem.mutate({ itemId: item.id, isCompleted: !item.is_completed })
                      }
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <ChecklistItem
                key={item.id}
                item={item}
                onToggle={() =>
                  toggleItem.mutate({ itemId: item.id, isCompleted: !item.is_completed })
                }
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
