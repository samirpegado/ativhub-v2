"use client";

import { useActionState, useCallback, useMemo, useState } from "react";
import { Pencil, Plus, Search, Signal, Trash2 } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteWorkOrder } from "@/app/(app)/work-orders/actions";
import type { LocationOption } from "@/lib/locations/queries";
import type { MutationState } from "@/lib/forms/state";
import type { PersonRecord, TeamRecord } from "@/lib/people/queries";
import type {
  CategoryOption,
  WorkOrderPerson,
  WorkOrderRecord,
} from "@/lib/work-orders/queries";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  workOrderPriorityLabel,
  workOrderStatusLabel,
} from "@/lib/work-orders/status";
import { cn } from "@/lib/utils";

type AssetOption = {
  id: string;
  name: string;
  custom_id: string | null;
  location_id: string | null;
};

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

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
  orders,
  locations,
  assets,
  people,
  teams,
  categories,
  checklists,
}: {
  orders: WorkOrderRecord[];
  locations: LocationOption[];
  assets: AssetOption[];
  people: PersonRecord[];
  teams: TeamRecord[];
  categories: CategoryOption[];
  checklists: ChecklistRecord[];
}) {
  const [editing, setEditing] = useState<WorkOrderRecord | null | "new">(null);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<string[]>(OPEN_STATUSES);
  const [priorities, setPriorities] = useState<string[]>(
    WORK_ORDER_PRIORITIES.map((item) => item.value),
  );
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    deleteWorkOrder,
    undefined,
  );
  const close = useCallback(() => setEditing(null), []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (!statuses.includes(order.status)) return false;
      if (!priorities.includes(order.priority)) return false;
      if (!needle) return true;
      return [
        order.customId,
        order.title,
        order.description,
        order.primaryUserName,
        ...order.assignees.map((person) => person.name),
        order.locationName,
        order.assetName,
        workOrderStatusLabel(order.status),
        workOrderPriorityLabel(order.priority),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [orders, priorities, query, statuses]);

  function toggle(list: string[], value: string, setList: (next: string[]) => void) {
    setList(
      list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-primary">
          <span className="px-3 py-2 text-sm font-semibold text-primary">Lista</span>
          <span
            className="cursor-not-allowed px-3 py-2 text-sm text-muted-foreground opacity-50"
            title="Em breve"
          >
            Calendário
          </span>
        </div>
        <Button className="h-9 font-semibold" onClick={() => setEditing("new")}>
          <Plus />
          Ordem de serviço
        </Button>
      </div>

      <Card className="items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]">
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9">
                <Signal />
                Prioridade
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {WORK_ORDER_PRIORITIES.map((item) => (
                <DropdownMenuCheckboxItem
                  key={item.value}
                  checked={priorities.includes(item.value)}
                  onCheckedChange={() => toggle(priorities, item.value, setPriorities)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {item.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9">
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {WORK_ORDER_STATUSES.map((item) => (
                <DropdownMenuCheckboxItem
                  key={item.value}
                  checked={statuses.includes(item.value)}
                  onCheckedChange={() => toggle(statuses, item.value, setStatuses)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {item.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar"
              className="h-9 pl-8"
            />
          </div>
        </div>
        {state?.error ? (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <Separator />
        {rows.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="max-w-md text-sm font-medium text-foreground">
              {orders.length === 0
                ? "Ordens de Serviço são tarefas ou trabalhos que podem ser agendados ou atribuídos a alguém"
                : "Nenhum resultado para a busca."}
            </p>
            <p className="text-sm text-muted-foreground">
              {orders.length === 0
                ? "Pressione o botão '+' para criar uma Ordem de Serviço"
                : "Tente outro termo ou ajuste os filtros."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  {["ID", "Status", "Título", "Prioridade", "Trabalhador", "Responsáveis", "Localização", "Ativo", "Vencimento"].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-xs font-semibold tracking-wide uppercase"
                      >
                        {header}
                      </th>
                    ),
                  )}
                  <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {order.customId ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("size-2.5 rounded-full", statusDot(order.status))} />
                        {workOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{order.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                          priorityClass(order.priority),
                        )}
                      >
                        {workOrderPriorityLabel(order.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PersonAvatars people={order.primaryUser ? [order.primaryUser] : []} />
                    </td>
                    <td className="px-4 py-3">
                      <PersonAvatars people={order.assignees} />
                    </td>
                    <td className="px-4 py-3">{order.locationName ?? "—"}</td>
                    <td className="px-4 py-3">{order.assetName ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatWhen(order.dueDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
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
      </Card>

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
            key={editing === "new" ? "new" : editing.id}
            order={editing === "new" ? undefined : editing}
            locations={locations}
            assets={assets}
            people={people}
            teams={teams}
            categories={categories}
            checklists={checklists}
            onCancel={close}
            onSuccess={close}
          />
        ) : null}
      </FormDialog>
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
