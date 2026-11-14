"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogOption } from "@/lib/filters/catalog";

export function CatalogSelect({
  label,
  placeholder,
  emptyLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  emptyLabel: string;
  options: CatalogOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const text = term.trim().toLowerCase();
  const visible = text
    ? options.filter((option) =>
        `${option.name} ${option.customerName ?? ""}`.toLowerCase().includes(text),
      )
    : options;
  const names = new Map(options.map((option) => [option.id, option.name]));
  const summary = selected.length === 0 ? "Todos" : selected.map((id) => names.get(id) ?? label).join(", ");

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-white px-2.5 text-left text-sm"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="space-y-1 rounded-lg border bg-white p-1">
          <Input value={term} placeholder={placeholder} className="h-8" onChange={(event) => setTerm(event.target.value)} />
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {visible.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyLabel}</p> : null}
            {visible.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span className="min-w-0">
                  <span className="block">{option.name}</span>
                  {option.customerName ? <span className="block text-xs text-muted-foreground">{option.customerName}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
