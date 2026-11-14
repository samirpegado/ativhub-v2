"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { searchWorkOrderLocations } from "@/app/(app)/work-orders/filter-actions";
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
import type { WorkOrderListQuery } from "@/lib/work-orders/list-params";
import { narrowsList } from "@/lib/work-orders/list-params";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
} from "@/lib/work-orders/status";

export type WorkOrderFilterDraft = {
  statuses: string[];
  priorities: string[];
  types: string[];
  locationIds: string[];
  overdue: boolean;
  dueFrom: string;
  dueTo: string;
};

const STATUS_OPTIONS = WORK_ORDER_STATUSES.map((item) => ({ value: item.value, label: item.label }));
const PRIORITY_OPTIONS = WORK_ORDER_PRIORITIES.map((item) => ({ value: item.value, label: item.label }));
const TYPE_OPTIONS = WORK_ORDER_TYPES.map((item) => ({ value: item.value, label: item.label }));

export function filtersFromQuery(query: WorkOrderListQuery): WorkOrderFilterDraft {
  return {
    statuses: query.statuses,
    priorities: query.priorities,
    types: query.types,
    locationIds: query.locationIds,
    overdue: query.overdue,
    dueFrom: query.dueFrom ?? "",
    dueTo: query.dueTo ?? "",
  };
}

export function emptyWorkOrderFilters(): WorkOrderFilterDraft {
  return {
    statuses: [],
    priorities: [],
    types: [],
    locationIds: [],
    overdue: false,
    dueFrom: "",
    dueTo: "",
  };
}

export function WorkOrderFiltersDialog({
  open,
  query,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  query: WorkOrderListQuery;
  onOpenChange: (open: boolean) => void;
  onApply: (draft: WorkOrderFilterDraft) => void;
}) {
  const [draft, setDraft] = useState<WorkOrderFilterDraft>(() => filtersFromQuery(query));

  useEffect(() => {
    if (open) setDraft(filtersFromQuery(query));
  }, [open, query]);

  function change(key: "statuses" | "priorities" | "types" | "locationIds", values: string[]) {
    setDraft((current) => ({ ...current, [key]: values }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 px-6 pt-5 pr-12 pb-3">
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>Nenhum ou todos os itens de uma lista mostram todas as ordens.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 [scrollbar-width:thin]">
          <MultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            selected={draft.statuses}
            onChange={(values) => change("statuses", values)}
          />
          <MultiSelect
            label="Prioridade"
            options={PRIORITY_OPTIONS}
            selected={draft.priorities}
            onChange={(values) => change("priorities", values)}
          />
          <MultiSelect
            label="Tipo"
            options={TYPE_OPTIONS}
            selected={draft.types}
            onChange={(values) => change("types", values)}
          />
          <LocationSelect
            selected={draft.locationIds}
            onChange={(values) => change("locationIds", values)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={draft.overdue}
              onChange={(event) => setDraft((current) => ({ ...current, overdue: event.target.checked }))}
            />
            Somente em atraso
          </label>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vencimento</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="work-order-due-from">De</Label>
                <Input
                  id="work-order-due-from"
                  type="date"
                  value={draft.dueFrom}
                  max={draft.dueTo || undefined}
                  onChange={(event) => setDraft((current) => ({ ...current, dueFrom: event.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="work-order-due-to">Até</Label>
                <Input
                  id="work-order-due-to"
                  type="date"
                  value={draft.dueTo}
                  min={draft.dueFrom || undefined}
                  onChange={(event) => setDraft((current) => ({ ...current, dueTo: event.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
          </fieldset>
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onApply(emptyWorkOrderFilters())}>
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
  const summary = !narrowsList(selected, all)
    ? "Todos"
    : selected
        .map((value) => options.find((option) => option.value === value)?.label ?? value)
        .join(", ");

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

function LocationSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const missing = selected.filter((id) => !names[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    searchWorkOrderLocations("", missing).then((rows) => {
      if (cancelled) return;
      setNames((current) => {
        const next = { ...current };
        for (const id of missing) next[id] = rows.find((row) => row.id === id)?.name ?? "Local";
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selected, names]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      searchWorkOrderLocations(term, selectedRef.current).then((rows) => {
        if (cancelled) return;
        setOptions(rows);
        setNames((current) => {
          const next = { ...current };
          for (const row of rows) next[row.id] = row.name;
          return next;
        });
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, term]);

  const summary = selected.length === 0 ? "Todos" : selected.map((id) => names[id] ?? "Local").join(", ");

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  return (
    <div className="space-y-1.5">
      <Label>Local</Label>
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
        <div className="space-y-1 rounded-lg border p-1">
          <Input
            value={term}
            placeholder="Buscar local"
            className="h-8"
            onChange={(event) => setTerm(event.target.value)}
          />
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {loading && options.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">Buscando…</p> : null}
            {!loading && options.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum local encontrado.</p> : null}
            {options.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                {option.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
