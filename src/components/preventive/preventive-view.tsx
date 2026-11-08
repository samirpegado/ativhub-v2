"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deletePreventive, deletePreventives } from "@/app/(app)/preventive/actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { RowCheckbox } from "@/components/lists/row-checkbox";
import { PreventiveForm } from "@/components/preventive/preventive-form";
import { listTdClass, listTdNameClass, listThClass } from "@/components/lists/table-classes";
import { TablePagination } from "@/components/lists/table-pagination";
import { useRowSelection } from "@/components/lists/use-row-selection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import type { MutationState } from "@/lib/forms/state";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { preventiveHref, type PreventiveListQuery } from "@/lib/preventive/list-params";
import type { PreventiveRecord, PreventiveScreen } from "@/lib/preventive/queries";
import { nextRunLabel } from "@/lib/preventive/schedule";
import { WORK_ORDER_PRIORITIES, workOrderPriorityLabel } from "@/lib/work-orders/status";
import { cn } from "@/lib/utils";

function priorityClass(priority: string) {
  if (priority === "HIGH") return "bg-destructive/10 text-destructive";
  if (priority === "MEDIUM") return "bg-amber-500/15 text-amber-700";
  if (priority === "LOW") return "bg-emerald-500/15 text-emerald-700";
  return "bg-muted text-muted-foreground";
}

export function PreventiveView({
  query,
  screen,
  canEdit,
}: {
  query: PreventiveListQuery;
  screen: PreventiveScreen;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [editing, setEditing] = useState<PreventiveRecord | "new" | null>(null);
  const [state, remove, pending] = useActionState<MutationState, FormData>(deletePreventive, undefined);
  const selection = useRowSelection(screen.items.map((item) => item.id));

  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.search) return;
    const handle = window.setTimeout(() => {
      visit({ search: trimmed, page: 1 });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search, query.search]);

  function visit(next: Partial<Pick<PreventiveListQuery, "search" | "priority" | "page">>) {
    startNavigation(() => {
      router.replace(
        preventiveHref({
          search: query.search,
          priority: query.priority,
          page: query.page,
          ...next,
        }),
        { scroll: false },
      );
    });
  }

  function removeSchedule(schedule: PreventiveRecord) {
    if (!window.confirm(`Excluir o agendamento ${schedule.name}? As ordens já criadas permanecem.`)) {
      return;
    }
    const data = new FormData();
    data.set("id", schedule.id);
    startNavigation(() => {
      remove(data);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Preventiva</h1>
        <Button className="h-9 font-semibold" onClick={() => setEditing("new")}>
          <Plus />
          Agendamento
        </Button>
      </div>
      <Card
        className={cn(
          "items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]",
          navigating && "opacity-70",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <NativeSelect
            className="h-9 w-48 shrink-0"
            value={query.priority ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              visit({
                priority: WORK_ORDER_PRIORITIES.some((item) => item.value === value) ? value : null,
                page: 1,
              });
            }}
          >
            <option value="">Todas as prioridades</option>
            {WORK_ORDER_PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
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
        {state?.error ? (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        {canEdit ? (
          <BulkActionBar
            count={selection.count}
            ids={selection.ids}
            onClear={selection.clear}
            actions={[
              {
                label: "Excluir",
                destructive: true,
                confirm: (count) =>
                  count === 1
                    ? "Excluir o agendamento selecionado? As ordens já criadas permanecem."
                    : `Excluir ${count} agendamentos? As ordens já criadas permanecem.`,
                run: deletePreventives,
              },
            ]}
          />
        ) : null}
        <Separator />
        {screen.items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium">
              {screen.totalAll === 0
                ? "Agendamentos geram ordens de serviço sozinhos"
                : "Nenhum resultado para a busca."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {screen.totalAll === 0
                ? "Pressione o botão para criar o primeiro"
                : "Tente outro termo ou ajuste o filtro."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  {canEdit ? (
                    <th className="w-10 px-4 py-3">
                      <RowCheckbox
                        checked={selection.allPage}
                        indeterminate={selection.somePage}
                        label="Selecionar os agendamentos desta página"
                        onChange={selection.togglePage}
                      />
                    </th>
                  ) : null}
                  {["Nome", "Ordem", "Prioridade", "Próxima", "Trabalhador", "Local", "Ativo"].map(
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
                {screen.items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                    onClick={() => router.push(`/preventive/${item.id}`)}
                  >
                    {canEdit ? (
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <RowCheckbox
                          checked={selection.isSelected(item.id)}
                          label={`Selecionar ${item.name}`}
                          onChange={() => selection.toggle(item.id)}
                        />
                      </td>
                    ) : null}
                    <td className={listTdNameClass}>
                      {item.customId ? <span className="mr-2">{item.customId}</span> : null}
                      {item.name}
                      {item.disabled ? (
                        <span className="ml-2 text-xs text-muted-foreground">Pausado</span>
                      ) : null}
                    </td>
                    <td className={listTdClass}>{item.title}</td>
                    <td className={listTdClass}>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                          priorityClass(item.priority),
                        )}
                      >
                        {workOrderPriorityLabel(item.priority)}
                      </span>
                    </td>
                    <td className={listTdClass}>{nextRunLabel(item)}</td>
                    <td className={listTdClass}>{item.primaryUserName ?? "—"}</td>
                    <td className={listTdClass}>{item.locationName ?? "—"}</td>
                    <td className={listTdClass}>{item.assetName ?? "—"}</td>
                    <td className={listTdClass}>
                      <div className="flex justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Editar ${item.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(item);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="size-8 text-destructive"
                          aria-label={`Excluir ${item.name}`}
                          disabled={pending}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeSchedule(item);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination
          page={query.page}
          pageSize={LIST_PAGE_SIZE}
          total={screen.total}
          pending={navigating}
          onPageChange={(page) => visit({ page })}
        />
      </Card>

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing && editing !== "new" ? "Editar agendamento" : "Novo agendamento"}
        description="A recorrência cria ordens de serviço com estes dados."
      >
        {editing ? (
          <PreventiveForm
            key={editing === "new" ? "new" : editing.id}
            schedule={editing === "new" ? undefined : editing}
            locations={screen.locations}
            assets={screen.assets}
            customers={screen.customers}
            people={screen.people}
            teams={screen.teams}
            checklists={screen.checklists}
            onCancel={() => setEditing(null)}
            onSuccess={() => setEditing(null)}
          />
        ) : null}
      </FormDialog>

    </div>
  );
}
