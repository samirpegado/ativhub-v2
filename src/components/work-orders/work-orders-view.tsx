"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ListFilter, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { RowCheckbox } from "@/components/lists/row-checkbox";
import { listTdClass, listTdIdClass, listThClass } from "@/components/lists/table-classes";
import { TablePagination } from "@/components/lists/table-pagination";
import { useRowSelection } from "@/components/lists/use-row-selection";
import { WorkOrderDrawer } from "@/components/work-orders/work-order-drawer";
import {
  WorkOrderFiltersDialog,
  type WorkOrderFilterDraft,
} from "@/components/work-orders/work-order-filters-dialog";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { WorkOrderTasksDialog } from "@/components/work-orders/work-order-tasks-dialog";

const WorkOrderCalendar = dynamic(
  () => import("./work-order-calendar").then((mod) => mod.WorkOrderCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        Carregando calendário…
      </div>
    ),
  },
);
import type { ChecklistRecord } from "@/lib/checklists/queries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteWorkOrder, deleteWorkOrders, updateWorkOrderDates } from "@/app/(app)/work-orders/actions";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { LocationOption } from "@/lib/locations/queries";
import type { MutationState } from "@/lib/forms/state";
import type { PersonRecord, TeamRecord } from "@/lib/people/queries";
import {
  workOrderActiveFilterCount,
  workOrderListHref,
  type WorkOrderListQuery,
} from "@/lib/work-orders/list-params";
import type {
  WorkOrderCalendarItem,
  WorkOrderPerson,
  WorkOrderRecord,
} from "@/lib/work-orders/queries";
import {
  workOrderIsOverdue,
  workOrderPriorityLabel,
  workOrderStatusLabel,
  workOrderTypeLabel,
} from "@/lib/work-orders/status";
import { cn } from "@/lib/utils";

type AssetOption = {
  id: string;
  name: string;
  custom_id: string | null;
  location_id: string | null;
};

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusDot(status: string) {
  if (status === "IN_PROGRESS") return "bg-emerald-500";
  if (status === "ON_HOLD") return "bg-amber-500";
  if (status === "COMPLETE") return "bg-sky-500";
  return "bg-muted-foreground/50";
}

function priorityClass(priority: string) {
  if (priority === "HIGH") return "bg-destructive/10 text-destructive";
  if (priority === "MEDIUM") return "bg-amber-500/15 text-amber-700";
  if (priority === "LOW") return "bg-emerald-500/15 text-emerald-700";
  return "bg-muted text-muted-foreground";
}

export function WorkOrdersView({
  query,
  orders,
  total,
  totalAll,
  calendar,
  locations,
  assets,
  people,
  teams,
  checklists,
  customers,
  canEdit,
  tenantId,
}: {
  query: WorkOrderListQuery;
  orders: WorkOrderRecord[];
  total: number;
  totalAll: number;
  calendar: WorkOrderCalendarItem[];
  locations: LocationOption[];
  assets: AssetOption[];
  people: PersonRecord[];
  teams: TeamRecord[];
  checklists: ChecklistRecord[];
  customers: { id: string; name: string; email: string | null }[];
  canEdit: boolean;
  tenantId: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [editing, setEditing] = useState<WorkOrderRecord | null | "new">(null);
  const [initialDue, setInitialDue] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answering, setAnswering] = useState<WorkOrderRecord | null>(null);
  const [taskRevision, setTaskRevision] = useState(0);
  const [dateField, setDateField] = useState<"start" | "due" | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [search, setSearch] = useState(query.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    deleteWorkOrder,
    undefined,
  );
  const view = query.calendar ? "calendar" : "list";
  const selection = useRowSelection(view === "list" ? orders.map((order) => order.id) : []);
  const close = useCallback(() => {
    setEditing(null);
    setInitialDue(null);
  }, []);

  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.search) return;
    const handle = window.setTimeout(() => {
      startNavigation(() => {
        router.replace(
          workOrderListHref({ ...query, search: trimmed, page: 1 }),
          { scroll: false },
        );
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, router, search]);

  function openNew(due?: string) {
    setInitialDue(due ?? null);
    setEditing("new");
  }

  function visit(next: Partial<WorkOrderListQuery> & { page?: number }) {
    startNavigation(() => {
      router.replace(
        workOrderListHref({
          search,
          statuses: query.statuses,
          priorities: query.priorities,
          locationIds: query.locationIds,
          types: query.types,
          overdue: query.overdue,
          dueFrom: query.dueFrom,
          dueTo: query.dueTo,
          page: query.page,
          calendar: query.calendar,
          ...next,
        }),
        { scroll: false },
      );
    });
  }

  function applyFilters(draft: WorkOrderFilterDraft) {
    setFiltersOpen(false);
    let dueFrom = draft.dueFrom || null;
    let dueTo = draft.dueTo || null;
    if (dueFrom && dueTo && dueFrom > dueTo) {
      const swap = dueFrom;
      dueFrom = dueTo;
      dueTo = swap;
    }
    visit({
      statuses: draft.statuses,
      priorities: draft.priorities,
      types: draft.types,
      locationIds: draft.locationIds,
      overdue: draft.overdue,
      dueFrom,
      dueTo,
      page: 1,
    });
  }

  const activeFilters = workOrderActiveFilterCount(query);

  return (
    <TooltipProvider>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {(
            [
              ["list", "Lista"],
              ["calendar", "Calendário"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => visit({ calendar: id === "calendar" })}
              className={cn(
                "border-b-2 px-3 py-2 text-sm",
                view === id
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => setFiltersOpen(true)}
          >
            <ListFilter />
            Filtros
            {activeFilters > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {activeFilters}
              </span>
            ) : null}
          </Button>
          <Button className="h-9 font-semibold" onClick={() => openNew()}>
            <Plus />
            Ordem de serviço
          </Button>
        </div>
      </div>

      <Card className={cn("items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]", navigating && "opacity-70")}>
        {view === "list" ? (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar"
              className="h-9 pl-8"
            />
          </div>
        </div>
        ) : null}
        {state?.error ? (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        {view === "list" && canEdit ? (
          <BulkActionBar
            count={selection.count}
            ids={selection.ids}
            onClear={selection.clear}
            actions={[
              { label: "Data de início", onSelect: () => { setDateError(null); setDateValue(""); setDateField("start"); } },
              { label: "Data de vencimento", onSelect: () => { setDateError(null); setDateValue(""); setDateField("due"); } },
              {
                label: "Excluir",
                destructive: true,
                confirm: (count) =>
                  count === 1
                    ? "Arquivar a ordem selecionada? Ela sai da lista."
                    : `Arquivar ${count} ordens? Elas saem da lista.`,
                run: deleteWorkOrders,
              },
            ]}
          />
        ) : null}
        {view === "list" ? <Separator /> : null}
        {view === "calendar" ? (
          <WorkOrderCalendar
            orders={calendar}
            canEdit={canEdit}
            onOpen={setOpenId}
            onCreate={(date, allDay) => {
              const next = new Date(date);
              if (allDay) next.setHours(9, 0, 0, 0);
              openNew(next.toISOString());
            }}
          />
        ) : orders.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="max-w-md text-sm font-medium text-foreground">
              {totalAll === 0
                ? "Ordens de Serviço são tarefas ou trabalhos que podem ser agendados ou atribuídos a alguém"
                : "Nenhum resultado para a busca."}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalAll === 0
                ? "Pressione o botão '+' para criar uma Ordem de Serviço"
                : "Tente outro termo ou ajuste os filtros."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  {canEdit ? (
                    <th className="w-10 px-4 py-3">
                      <RowCheckbox
                        checked={selection.allPage}
                        indeterminate={selection.somePage}
                        label="Selecionar as ordens desta página"
                        onChange={selection.togglePage}
                      />
                    </th>
                  ) : null}
                  {["ID", "Status", "Título", "Prioridade", "Responsáveis", "Localização", "Ativo", "Vencimento"].map(
                    (header) => (
                      <th key={header} className={listThClass}>
                        {header}
                      </th>
                    ),
                  )}
                  <th className={`${listThClass} text-center`}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                    onClick={() => setOpenId(order.id)}
                  >
                    {canEdit ? (
                      <td className={listTdClass} onClick={(event) => event.stopPropagation()}>
                        <RowCheckbox
                          checked={selection.isSelected(order.id)}
                          label={`Selecionar ${order.title}`}
                          onChange={() => selection.toggle(order.id)}
                        />
                      </td>
                    ) : null}
                    <td className={listTdIdClass}>{order.customId ?? "—"}</td>
                    <td className={`${listTdClass} whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("size-2.5 shrink-0 rounded-full", statusDot(order.status))} />
                        {workOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className={listTdClass}>
                      <div className="flex w-56 max-w-56 flex-col gap-1.5">
                        <span className="line-clamp-2 break-words font-medium leading-snug">{order.title}</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                            {workOrderTypeLabel(order.type)}
                          </span>
                          {workOrderIsOverdue(order) ? (
                            <span className="inline-flex rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              Em atraso
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className={listTdClass}>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                          priorityClass(order.priority),
                        )}
                      >
                        {workOrderPriorityLabel(order.priority)}
                      </span>
                    </td>
                    <td className={listTdClass}>
                      <PersonAvatars people={order.assignees} />
                    </td>
                    <td className={listTdClass}>
                      <span className="line-clamp-2 w-36 max-w-36 break-words">{order.locationName ?? "—"}</span>
                    </td>
                    <td className={listTdClass}>
                      <span className="line-clamp-2 w-36 max-w-36 break-words">{order.assetName ?? "—"}</span>
                    </td>
                    <td className={`${listTdClass} whitespace-nowrap`}>{formatWhen(order.dueDate)}</td>
                    <td className={listTdClass} onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-primary hover:bg-primary/10 hover:text-primary"
                          aria-label={`Responder tarefas de ${order.title}`}
                          onClick={() => setAnswering(order)}
                        >
                          <ClipboardCheck className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-primary hover:bg-primary/10 hover:text-primary"
                          aria-label={`Editar ${order.title}`}
                          onClick={() => setEditing(order)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <form
                          action={formAction}
                          onSubmit={(event) => {
                            if (!window.confirm(`Excluir a ordem "${order.title}"?`)) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={order.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remover ${order.title}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {view === "list" ? (
          <TablePagination
            page={query.page}
            pageSize={LIST_PAGE_SIZE}
            total={total}
            pending={navigating}
            onPageChange={(page) => visit({ page })}
          />
        ) : null}
      </Card>

      <WorkOrderFiltersDialog
        open={filtersOpen}
        query={query}
        locations={locations}
        onOpenChange={setFiltersOpen}
        onApply={applyFilters}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={editing && editing !== "new" ? "Editar ordem de serviço" : "Nova ordem de serviço"}
        description="Só o título é obrigatório. O restante pode ser preenchido depois."
      >
        {editing ? (
          <WorkOrderForm
            key={editing === "new" ? `new-${initialDue ?? ""}` : editing.id}
            order={editing === "new" ? undefined : editing}
            initialDueDate={editing === "new" ? initialDue : null}
            locations={locations}
            assets={assets}
            people={people}
            teams={teams}
            checklists={checklists}
            customers={customers}
            onCancel={close}
            onSuccess={close}
          />
        ) : null}
      </FormDialog>

      <WorkOrderDrawer
        orderId={openId}
        order={orders.find((order) => order.id === openId) ?? null}
        tenantId={tenantId}
        open={openId !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        onEdit={(order) => {
          setOpenId(null);
          setEditing(order);
        }}
        onAnswer={setAnswering}
        reloadToken={taskRevision}
        canEdit={canEdit}
      />

      <FormDialog
        open={dateField !== null}
        onOpenChange={(open) => {
          if (!open) setDateField(null);
        }}
        title={dateField === "start" ? "Alterar data de início" : "Alterar data de vencimento"}
        description="A data vale para as ordens selecionadas nesta página."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!dateField) return;
            const field = dateField;
            startNavigation(async () => {
              const result = await updateWorkOrderDates(selection.ids, field, dateValue);
              if (result?.error) {
                setDateError(result.error);
                return;
              }
              selection.clear();
              setDateField(null);
            });
          }}
        >
          {dateError ? (
            <Alert variant="destructive">
              <AlertDescription>{dateError}</AlertDescription>
            </Alert>
          ) : null}
          <Input
            type="datetime-local"
            required
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="h-9"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDateField(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={navigating || selection.count === 0}>
              Aplicar
            </Button>
          </div>
        </form>
      </FormDialog>

      <WorkOrderTasksDialog
        order={answering}
        onOpenChange={(next) => {
          if (!next) setAnswering(null);
        }}
        onExecuted={(next) => {
          setAnswering(next);
          setTaskRevision((current) => current + 1);
        }}
      />
    </div>
    </TooltipProvider>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function PersonAvatars({ people }: { people: WorkOrderPerson[] }) {
  if (people.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex items-center pl-1">
      {people.map((person) => (
        <Tooltip key={person.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="-ml-1 flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-muted text-[11px] font-semibold text-foreground"
              aria-label={person.name}
            >
              {person.imageUrl ? (
                // URL assinada do Storage.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={person.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                initials(person.name)
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{person.name}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
