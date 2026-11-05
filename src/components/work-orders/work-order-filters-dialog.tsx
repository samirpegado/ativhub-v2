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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocationOption } from "@/lib/locations/queries";
import {
  DEFAULT_WORK_ORDER_PRIORITIES,
  DEFAULT_WORK_ORDER_STATUSES,
  type WorkOrderListQuery,
} from "@/lib/work-orders/list-params";
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

const DEFAULT_TYPES = WORK_ORDER_TYPES.map((item) => item.value);

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
    statuses: [...DEFAULT_WORK_ORDER_STATUSES],
    priorities: [...DEFAULT_WORK_ORDER_PRIORITIES],
    types: [...DEFAULT_TYPES],
    locationIds: [],
    overdue: false,
    dueFrom: "",
    dueTo: "",
  };
}

export function WorkOrderFiltersDialog({
  open,
  query,
  locations,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  query: WorkOrderListQuery;
  locations: LocationOption[];
  onOpenChange: (open: boolean) => void;
  onApply: (draft: WorkOrderFilterDraft) => void;
}) {
  const [draft, setDraft] = useState<WorkOrderFilterDraft>(() => filtersFromQuery(query));

  useEffect(() => {
    if (open) setDraft(filtersFromQuery(query));
  }, [open, query]);

  function toggle(key: "statuses" | "priorities" | "types" | "locationIds", value: string) {
    setDraft((current) => {
      const list = current[key];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 px-6 pt-5 pr-12 pb-3">
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>Escolha o que entra na lista e aplique de uma vez.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5 [scrollbar-width:thin]">
          <FilterGroup
            label="Status"
            options={WORK_ORDER_STATUSES.map((item) => ({ value: item.value, label: item.label }))}
            selected={draft.statuses}
            onToggle={(value) => toggle("statuses", value)}
          />
          <FilterGroup
            label="Prioridade"
            options={WORK_ORDER_PRIORITIES.map((item) => ({ value: item.value, label: item.label }))}
            selected={draft.priorities}
            onToggle={(value) => toggle("priorities", value)}
          />
          <FilterGroup
            label="Tipo"
            options={WORK_ORDER_TYPES.map((item) => ({ value: item.value, label: item.label }))}
            selected={draft.types}
            onToggle={(value) => toggle("types", value)}
          />
          <FilterGroup
            label="Local"
            options={locations.map((location) => ({ value: location.id, label: location.name }))}
            selected={draft.locationIds}
            onToggle={(value) => toggle("locationIds", value)}
            emptyLabel="Nenhum local cadastrado."
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={draft.overdue}
              onChange={(event) =>
                setDraft((current) => ({ ...current, overdue: event.target.checked }))
              }
            />
            Somente em atraso
          </label>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Vencimento
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="work-order-due-from">De</Label>
                <Input
                  id="work-order-due-from"
                  type="date"
                  value={draft.dueFrom}
                  max={draft.dueTo || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, dueFrom: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, dueTo: event.target.value }))
                  }
                  className="h-9"
                />
              </div>
            </div>
          </fieldset>
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onApply(emptyWorkOrderFilters())}
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
      <legend className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex max-h-36 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
