"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AssetCategory } from "@/lib/categories/queries";
import type { AssetListQuery } from "@/lib/assets/list-params";
import { ASSET_STATUSES } from "@/lib/assets/status";
import type { LocationOption } from "@/lib/locations/queries";

export type AssetFilterDraft = {
  statuses: string[];
  categoryIds: string[];
  locationIds: string[];
};

export function filtersFromQuery(query: AssetListQuery): AssetFilterDraft {
  return {
    statuses: query.statuses,
    categoryIds: query.categoryIds,
    locationIds: query.locationIds,
  };
}

export function AssetFiltersDialog({
  open,
  query,
  categories,
  locations,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  query: AssetListQuery;
  categories: AssetCategory[];
  locations: LocationOption[];
  onOpenChange: (open: boolean) => void;
  onApply: (draft: AssetFilterDraft) => void;
}) {
  const [draft, setDraft] = useState<AssetFilterDraft>(() => filtersFromQuery(query));

  useEffect(() => {
    if (open) setDraft(filtersFromQuery(query));
  }, [open, query]);

  function toggle(key: keyof AssetFilterDraft, value: string) {
    setDraft((current) => {
      const selected = current[key];
      return {
        ...current,
        [key]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 px-6 pt-5 pr-12 pb-3">
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>Categoria, status e localização.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-4">
          <FilterGroup
            label="Status"
            options={ASSET_STATUSES.map((item) => ({ value: item.value, label: item.label }))}
            selected={draft.statuses}
            onToggle={(value) => toggle("statuses", value)}
          />
          <FilterGroup
            label="Categoria"
            options={categories.map((item) => ({ value: item.id, label: item.name }))}
            selected={draft.categoryIds}
            onToggle={(value) => toggle("categoryIds", value)}
            emptyLabel="Nenhuma categoria cadastrada."
          />
          <FilterGroup
            label="Localização"
            options={locations.map((item) => ({
              value: item.id,
              label: item.custom_id ? `${item.custom_id} · ${item.name}` : item.name,
            }))}
            selected={draft.locationIds}
            onToggle={(value) => toggle("locationIds", value)}
            emptyLabel="Nenhuma localização cadastrada."
          />
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onApply({ statuses: [], categoryIds: [], locationIds: [] })}
          >
            Limpar
          </Button>
          <Button type="button" onClick={() => onApply(draft)}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
  emptyLabel,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyLabel?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
