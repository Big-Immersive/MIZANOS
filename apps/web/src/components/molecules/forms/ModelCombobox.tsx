"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command } from "cmdk";
import { cn } from "@/lib/utils/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/atoms/layout/Popover";

interface ModelOption {
  value: string;
  label: string;
  tier: "premium" | "standard" | "budget";
  description: string;
}

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  premium: {
    label: "Premium",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  standard: {
    label: "Standard",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  budget: {
    label: "Budget",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

const OPENROUTER_MODELS: ModelOption[] = [
  {
    value: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    tier: "standard",
    description: "Best balance of speed, cost & quality",
  },
  {
    value: "anthropic/claude-opus-4",
    label: "Claude Opus 4",
    tier: "premium",
    description: "Highest quality, complex reasoning",
  },
  {
    value: "anthropic/claude-haiku-4",
    label: "Claude Haiku 4",
    tier: "budget",
    description: "Fast & affordable for simple tasks",
  },
  {
    value: "openai/gpt-4o",
    label: "GPT-4o",
    tier: "standard",
    description: "OpenAI multimodal flagship",
  },
  {
    value: "openai/gpt-4.1",
    label: "GPT-4.1",
    tier: "premium",
    description: "Latest OpenAI model, advanced coding",
  },
  {
    value: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    tier: "budget",
    description: "Low-cost OpenAI for light tasks",
  },
  {
    value: "google/gemini-2.5-pro-preview",
    label: "Gemini 2.5 Pro",
    tier: "standard",
    description: "Google flagship, long context",
  },
  {
    value: "google/gemini-2.5-flash-preview",
    label: "Gemini 2.5 Flash",
    tier: "budget",
    description: "Fast Google model, great value",
  },
  {
    value: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    tier: "budget",
    description: "Cheapest stable Gemini — Mizan default",
  },
  {
    value: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    tier: "budget",
    description: "Strong reasoning, very low cost",
  },
];

const OPENAI_MODELS: ModelOption[] = [
  {
    value: "gpt-4o",
    label: "GPT-4o",
    tier: "standard",
    description: "Multimodal flagship",
  },
  {
    value: "gpt-4.1",
    label: "GPT-4.1",
    tier: "premium",
    description: "Latest model, advanced coding",
  },
  {
    value: "gpt-4o-mini",
    label: "GPT-4o Mini",
    tier: "budget",
    description: "Low-cost for light tasks",
  },
  {
    value: "o3",
    label: "o3",
    tier: "premium",
    description: "Advanced reasoning model",
  },
  {
    value: "o3-mini",
    label: "o3 Mini",
    tier: "standard",
    description: "Efficient reasoning",
  },
];

interface ModelComboboxProps {
  value: string;
  provider: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ModelCombobox({
  value,
  provider,
  onValueChange,
  disabled,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const models = provider === "openai" ? OPENAI_MODELS : OPENROUTER_MODELS;

  const filtered = search
    ? models.filter(
        (m) =>
          m.label.toLowerCase().includes(search.toLowerCase()) ||
          m.value.toLowerCase().includes(search.toLowerCase()),
      )
    : models;

  const selectedLabel = models.find((m) => m.value === value)?.label;

  const handleSelect = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleCustomSubmit = () => {
    if (search.trim() && !models.some((m) => m.value === search.trim())) {
      onValueChange(search.trim());
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
        >
          <span
            className={cn("truncate", !value && "text-muted-foreground")}
          >
            {selectedLabel ?? (value || "Select model...")}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command className="rounded-md border-0" shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Command.Input
              placeholder="Search or type custom model ID..."
              value={search}
              onValueChange={setSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length === 0) {
                  handleCustomSubmit();
                }
              }}
              className="flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[280px] overflow-y-auto p-1">
            {filtered.length === 0 && search.trim() && (
              <Command.Item
                value={search.trim()}
                onSelect={() => handleCustomSubmit()}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent data-[selected=true]:bg-accent"
              >
                <span className="text-muted-foreground">
                  Use custom: <strong>{search.trim()}</strong>
                </span>
              </Command.Item>
            )}
            {filtered.map((model) => {
              const badge = TIER_BADGE[model.tier];
              return (
                <Command.Item
                  key={model.value}
                  value={model.value}
                  onSelect={() => handleSelect(model.value)}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent data-[selected=true]:bg-accent"
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value === model.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {model.label}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none shrink-0",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {model.description}
                    </span>
                  </div>
                </Command.Item>
              );
            })}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
