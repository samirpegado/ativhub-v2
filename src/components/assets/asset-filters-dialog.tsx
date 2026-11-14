"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CatalogSelect } from "@/components/filters/catalog-select";
import { useFilterCatalog } from "@/components/filters/filter-catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { AssetListQuery } from "@/lib/assets/list-params";
import { narrowsAssetList } from "@/lib/assets/list-params";
import { ASSET_STATUSES } from "@/lib/assets/status";

export type AssetFilterDraft = {
  statuses: string[];
  categoryIds: string[];
  locationIds: string[];
};

const STATUS_OPTIONS = ASSET_STATUSES.map((item) => ({ value: item.value, label: item.label }));

export function filtersFromQuery(query: AssetListQuery): AssetFilterDraft {
  return {
    statuses: query.statuses,
    categoryIds: query.categoryIds,
    locationIds: query.locationIds,
  };
}

export function emptyAssetFilters(): AssetFilterDraft {
  return { statuses: [], categoryIds: [], locationIds: [] };
}

export function AssetFiltersDialog({
  open,
  query,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  query: AssetListQuery;
  onOpenChange: (open: boolean) => void;
  onApply: (draft: AssetFilterDraft) => void;
}) {
  const catalog = useFilterCatalog();
  const [draft, setDraft] = useState<AssetFilterDraft>(() => filtersFromQuery(query));

  useEffect(() => {
    if (open) setDraft(filtersFromQuery(query));
  }, [open, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 px-6 pt-5 pr-12 pb-3">
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>Nenhum ou todos os itens de uma lista mostram todos os ativos.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 [scrollbar-width:thin]">
          <MultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            selected={draft.statuses}
            onChange={(statuses) => setDraft((current) => ({ ...current, statuses }))}
          />
          <CatalogSelect
            label="Categoria"
            placeholder="Buscar categoria"
            emptyLabel="Nenhuma categoria encontrada."
            options={catalog.categories}
            selected={draft.categoryIds}
            onChange={(categoryIds) => setDraft((current) => ({ ...current, categoryIds }))}
          />
          <CatalogSelect
            label="Localização"
            placeholder="Buscar localização"
            emptyLabel="Nenhuma localização encontrada."
            options={catalog.locations}
            selected={draft.locationIds}
            onChange={(locationIds) => setDraft((current) => ({ ...current, locationIds }))}
          />
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onApply(emptyAssetFilters())}>
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

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const all = options.map((option) => option.value);
  const summary = !narrowsAssetList(selected, all)
    ? "Todos"
    : selected.map((value) => options.find((option) => option.value === value)?.label ?? value).join(", ");

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
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
        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border p-1">
          {options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

