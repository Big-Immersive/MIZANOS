"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command } from "cmdk";
import { cn } from "@/lib/utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/atoms/layout/Popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowClear?: boolean;
  clearLabel?: string;
}

export function SearchableSelect({
  label,
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  emptyLabel = "No results found.",
  allowClear = false,
  clearLabel = "None",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const deduped = options.filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i);
  const filtered = search
    ? deduped.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : deduped;

  const handleSelect = (val: string) => {
    onValueChange(val === value ? "" : val);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="space-y-1.5 min-w-0">
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-9 w-full items-center justify-between overflow-hidden rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
              {selectedLabel ?? placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command className="rounded-md border-0" shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Command.Input
                placeholder="Search..."
                value={search}
                onValueChange={setSearch}
                className="flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-[200px] overflow-y-auto p-1">
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
              )}
              {allowClear && (
                <Command.Item
                  value="__clear__"
                  onSelect={() => handleSelect("")}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent data-[selected=true]:bg-accent"
                >
                  <Check className={cn("h-3.5 w-3.5", value ? "opacity-0" : "opacity-100")} />
                  <span className="text-muted-foreground">{clearLabel}</span>
                </Command.Item>
              )}
              {filtered.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent data-[selected=true]:bg-accent"
                >
                  <Check className={cn("h-3.5 w-3.5", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
