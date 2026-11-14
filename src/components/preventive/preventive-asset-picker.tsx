"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ListFilter } from "lucide-react";
import { searchPickerAssets } from "@/app/(app)/assets/picker-actions";
import { selectFilteredPreventiveAssets, type PreventiveAssetHit } from "@/app/(app)/preventive/filter-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { narrowsAssetList } from "@/lib/assets/list-params";
import { ASSET_STATUSES } from "@/lib/assets/status";

const STATUS_OPTIONS = ASSET_STATUSES.map((item) => ({ value: item.value, label: item.label }));

function blankAsset(id: string): PreventiveAssetHit {
  return { id, name: "Ativo", customId: null, locationId: null, customerId: null, locationLabel: null };
}

export function PreventiveAssetPicker({
  assetIds = [],
  onCountChange,
  selection = "multiple",
  selectedId = null,
  onSelected,
  required = false,
}: {
  assetIds?: string[];
  onCountChange?: (count: number) => void;
  selection?: "multiple" | "single";
  selectedId?: string | null;
  onSelected?: (asset: PreventiveAssetHit | null) => void;
  required?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const searchId = useId();
  const single = selection === "single";
  const onSelectedRef = useRef(onSelected);
  onSelectedRef.current = onSelected;
  const [chosen, setChosen] = useState<PreventiveAssetHit[]>(() =>
    single ? (selectedId ? [blankAsset(selectedId)] : []) : assetIds.map((id) => blankAsset(id)),
  );
  const [results, setResults] = useState<PreventiveAssetHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [matchedIds, setMatchedIds] = useState<{ key: string; ids: string[] } | null>(null);
  const [reload, setReload] = useState(0);
  const refreshNow = useRef(false);
  const catalog = useFilterCatalog();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStatuses, setDraftStatuses] = useState<string[]>([]);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([]);
  const [draftLocationIds, setDraftLocationIds] = useState<string[]>([]);
  const chosenIds = chosen.map((item) => item.id).join(",");

  useEffect(() => {
    onCountChange?.(chosen.length);
  }, [chosen.length, onCountChange]);

  useEffect(() => {
    if (!single) return;
    setChosen((current) => {
      if (!selectedId) return current.length === 0 ? current : [];
      if (current[0]?.id === selectedId) return current;
      return [blankAsset(selectedId)];
    });
  }, [selectedId, single]);
  const filterKey = `${term}\n${statuses.join(",")}\n${categoryIds.join(",")}\n${locationIds.join(",")}`;
  const chosenIdSet = new Set(chosen.map((item) => item.id));
  const allSelected = Boolean(
    matchedIds &&
      matchedIds.key === filterKey &&
      matchedIds.ids.length > 0 &&
      matchedIds.ids.every((id) => chosenIdSet.has(id)),
  );
  const filterCount =
    (narrowsAssetList(statuses, STATUS_OPTIONS.map((item) => item.value)) ? 1 : 0) +
    (categoryIds.length > 0 ? 1 : 0) +
    (locationIds.length > 0 ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    const delay = refreshNow.current ? 0 : 250;
    refreshNow.current = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      searchPickerAssets({
        term,
        statuses,
        categoryIds,
        locationIds,
        selectedIds: chosenIds ? chosenIds.split(",") : [],
      }).then((payload) => {
        if (cancelled) return;
        setResults(payload.results);
        setChosen((current) => current.map((item) => payload.selected.find((row) => row.id === item.id) ?? item));
        if (single) {
          const hit = payload.selected.find((row) => row.id === chosenIds);
          if (hit) onSelectedRef.current?.(hit);
        }
        setLoading(false);
      });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [categoryIds, chosenIds, locationIds, reload, single, statuses, term]);

  function toggle(asset: PreventiveAssetHit) {
    if (single) {
      const next = chosen[0]?.id === asset.id ? null : asset;
      setChosen(next ? [next] : []);
      onSelected?.(next);
      return;
    }
    setChosen((current) =>
      current.some((item) => item.id === asset.id)
        ? current.filter((item) => item.id !== asset.id)
        : [...current, asset],
    );
  }

  const visibleIds = new Set(results.map((asset) => asset.id));

  function openFilters() {
    setDraftStatuses(statuses);
    setDraftCategoryIds(categoryIds);
    setDraftLocationIds(locationIds);
    setFiltersOpen(true);
  }

  function refreshList() {
    refreshNow.current = true;
    setResults([]);
    setLoading(true);
    setReload((current) => current + 1);
  }

  function selectAll() {
    if (allSelected && matchedIds) {
      const drop = new Set(matchedIds.ids);
      setChosen((current) => current.filter((item) => !drop.has(item.id)));
      return;
    }
    setSelecting(true);
    selectFilteredPreventiveAssets({ term, statuses, categoryIds, locationIds }).then((rows) => {
      setChosen((current) => {
        const next = new Map(current.map((item) => [item.id, item]));
        for (const row of rows) next.set(row.id, row);
        return [...next.values()];
      });
      setMatchedIds({ key: filterKey, ids: rows.map((row) => row.id) });
      setSelecting(false);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3 sm:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={searchId}>Buscar ativo</Label>
          <Input
            id={searchId}
            value={term}
            placeholder="Nome, código, modelo ou número de série"
            className="h-9 bg-white"
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9 bg-white" onClick={openFilters}>
            <ListFilter />
            Filtros
            {filterCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {filterCount}
              </span>
            ) : null}
          </Button>
          {single ? null : (
            <Button
              type="button"
              variant="outline"
              className="h-9 bg-white"
              disabled={selecting || (!allSelected && (loading || results.length === 0))}
              onClick={selectAll}
            >
              {allSelected ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          )}
        </div>
      </div>
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border bg-white p-2">
        {loading && results.length === 0 ? <p className="px-1 py-1.5 text-sm text-muted-foreground">Buscando…</p> : null}
        {!loading && results.length === 0 ? <p className="px-1 py-1.5 text-sm text-muted-foreground">Nenhum ativo encontrado.</p> : null}
        {results.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            checked={chosen.some((item) => item.id === asset.id)}
            named={!single}
            onToggle={() => toggle(asset)}
          />
        ))}
      </div>
      {single ? (
        <input
          className="sr-only"
          name="asset_id"
          value={chosen[0]?.id ?? ""}
          required={required}
          onChange={() => undefined}
        />
      ) : chosen.filter((asset) => !visibleIds.has(asset.id)).map((asset) => (
        <input key={asset.id} type="hidden" name="asset_ids" value={asset.id} />
      ))}
      {chosen.length > 0 ? <p className="text-xs text-muted-foreground">{chosen.length} selecionado{chosen.length === 1 ? "" : "s"}</p> : null}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-6 pt-5 pr-12 pb-3">
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription>Nenhum ou todos os status mostram todos os ativos.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5">
            <MultiSelect label="Status" options={STATUS_OPTIONS} selected={draftStatuses} onChange={setDraftStatuses} />
            <CatalogSelect
              label="Categoria"
              placeholder="Buscar categoria"
              emptyLabel="Nenhuma categoria encontrada."
              options={catalog.categories}
              selected={draftCategoryIds}
              onChange={setDraftCategoryIds}
            />
            <CatalogSelect
              label="Localização"
              placeholder="Buscar localização"
              emptyLabel="Nenhuma localização encontrada."
              options={catalog.locations}
              selected={draftLocationIds}
              onChange={setDraftLocationIds}
            />
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                refreshList();
                setStatuses([]);
                setCategoryIds([]);
                setLocationIds([]);
                setFiltersOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button
              type="button"
              onClick={() => {
                refreshList();
                setStatuses(draftStatuses);
                setCategoryIds(draftCategoryIds);
                setLocationIds(draftLocationIds);
                setFiltersOpen(false);
              }}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetRow({
  asset,
  checked,
  named,
  onToggle,
}: {
  asset: PreventiveAssetHit;
  checked: boolean;
  named: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted">
      <input
        type="checkbox"
        name={named ? "asset_ids" : undefined}
        value={named ? asset.id : undefined}
        className="mt-0.5 size-4 accent-primary"
        checked={checked}
        onChange={onToggle}
      />
      <span className="min-w-0">
        <span className="block">{asset.customId ? `${asset.customId} · ${asset.name}` : asset.name}</span>
        {asset.locationLabel ? <span className="block text-xs text-muted-foreground">{asset.locationLabel}</span> : null}
      </span>
    </label>
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
        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border bg-white p-1">
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
