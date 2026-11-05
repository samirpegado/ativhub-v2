"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { approveRequest, createRequest, deleteRequests, rejectRequest, updateRequest } from "@/app/(app)/requests/actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { RowCheckbox } from "@/components/lists/row-checkbox";
import { useRowSelection } from "@/components/lists/use-row-selection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { listTdClass, listTdIdClass, listThClass } from "@/components/lists/table-classes";
import { TablePagination } from "@/components/lists/table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import {
  REQUEST_STATUSES,
  requestHref,
  type RequestListQuery,
} from "@/lib/requests/list-params";
import { requestState, type RequestRecord } from "@/lib/requests/payload";
import type { MutationState } from "@/lib/forms/state";
import type { WorkOrderEditorData } from "@/lib/work-orders/queries";
import { cn } from "@/lib/utils";

const STATE_LABEL = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function RequestsView({
  query,
  canEdit,
  isAdmin,
  assets,
  items,
  total,
  totalAll,
}: {
  query: RequestListQuery;
  canEdit: boolean;
  isAdmin: boolean;
  assets: { id: string; name: string }[];
  items: RequestRecord[];
  total: number;
  totalAll: number;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [open, setOpen] = useState<RequestRecord | null>(null);
  const [editing, setEditing] = useState<RequestRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [editor, setEditor] = useState<WorkOrderEditorData | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const rowIds = useMemo(() => (canEdit ? items.map((item) => item.id) : []), [canEdit, items]);
  const pendingIds = useMemo(
    () => items.filter((item) => requestState(item) === "pending").map((item) => item.id),
    [items],
  );
  const pendingSet = useMemo(() => new Set(pendingIds), [pendingIds]);
  const selection = useRowSelection(rowIds);

  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.search) return;
    const handle = window.setTimeout(() => {
      startNavigation(() => {
        router.replace(requestHref({ ...query, search: trimmed, page: 1 }), { scroll: false });
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, router, search]);

  function visit(next: Partial<RequestListQuery> & { page?: number }) {
    startNavigation(() => {
      router.replace(
        requestHref({ search, status: query.status, page: query.page, ...next }),
        { scroll: false },
      );
    });
  }

  function closeSheet() {
    setOpen(null);
    setReason("");
    setError(null);
  }

  function beginEdit(request: RequestRecord) {
    if (requestState(request) !== "pending") {
      setListError("Só uma solicitação pendente pode ser editada.");
      return;
    }
    setListError(null);
    const sheetWasOpen = open?.id === request.id;
    closeSheet();
    if (sheetWasOpen) window.setTimeout(() => setEditing(request), 0);
    else setEditing(request);
  }

  async function decide(kind: "approve" | "reject") {
    if (!open) return;
    setDeciding(true);
    setError(null);
    if (kind === "approve") {
      const result = await approveRequest(open.id);
      setDeciding(false);
      if ("error" in result) {
        setError(result.error);
        router.refresh();
        return;
      }
      closeSheet();
      setEditor(result.editor);
      router.refresh();
      return;
    }
    const result = await rejectRequest(open.id, reason);
    setDeciding(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    closeSheet();
    router.refresh();
  }

  async function remove(request: RequestRecord) {
    if (requestState(request) !== "pending") {
      setListError("Só uma solicitação pendente pode ser excluída.");
      return;
    }
    if (!window.confirm("Excluir esta solicitação pendente?")) return;
    setDeciding(true);
    setError(null);
    setListError(null);
    const result = await deleteRequests([request.id]);
    setDeciding(false);
    if (result?.error) {
      if (open?.id === request.id) setError(result.error);
      else setListError(result.error);
      return;
    }
    closeSheet();
    selection.clear();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Card className={cn("items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]", navigating && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <NativeSelect
            className="h-9 w-48 shrink-0"
            value={query.status ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              visit({
                status: value === "pending" || value === "approved" || value === "rejected" ? value : null,
                page: 1,
              });
            }}
          >
            <option value="">Todas</option>
            {REQUEST_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </NativeSelect>
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar" className="h-9 pl-8" />
          </div>
          {canEdit ? (
            <Button type="button" className="h-9 font-semibold" onClick={() => setCreating(true)}>
              <Plus />
              Solicitação
            </Button>
          ) : null}
        </div>
        {listError ? (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{listError}</AlertDescription>
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
                confirm: () => {
                  const count = selection.ids.filter((id) => pendingSet.has(id)).length;
                  return count === 1
                    ? "Excluir a solicitação pendente selecionada?"
                    : `Excluir ${count} solicitações pendentes?`;
                },
                ...(selection.ids.some((id) => pendingSet.has(id))
                  ? {
                      run: async (ids: string[]) => {
                        const pending = ids.filter((id) => pendingSet.has(id));
                        const result = await deleteRequests(pending);
                        if (result && !result.error) router.refresh();
                        return result;
                      },
                    }
                  : {
                      onSelect: () =>
                        setListError("Só solicitações pendentes podem ser excluídas."),
                    }),
              },
            ]}
          />
        ) : null}
        <Separator />
        {items.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="max-w-md text-sm font-medium">
              {totalAll === 0 ? "Solicitações feitas pelo QR do ativo aparecem aqui" : "Nenhum resultado para a busca."}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalAll === 0 ? "A pessoa na frente do equipamento pede manutenção sem login." : "Tente outro termo ou ajuste o filtro."}
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  {canEdit ? (
                    <th className="w-10 px-4 py-3">
                      <RowCheckbox
                        checked={selection.allPage}
                        indeterminate={selection.somePage}
                        label="Selecionar as solicitações desta página"
                        onChange={selection.togglePage}
                      />
                    </th>
                  ) : null}
                  {["Código", "Solicitante", "Ativo", "Quando", "Situação"].map((header) => (
                    <th key={header} className={listThClass}>{header}</th>
                  ))}
                  {canEdit ? <th className={`${listThClass} sticky right-0 z-10 bg-muted text-center`}>Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const state = requestState(item);
                  const pendingRow = state === "pending";
                  return (
                    <tr key={item.id} className="group cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => { setOpen(item); setReason(""); setError(null); }}>
                      {canEdit ? (
                        <td className={listTdClass} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                          <RowCheckbox
                            checked={selection.isSelected(item.id)}
                            label={`Selecionar ${item.title}`}
                            onChange={() => selection.toggle(item.id)}
                          />
                        </td>
                      ) : null}
                      <td className={listTdIdClass}>{item.customId ?? "—"}</td>
                      <td className={listTdClass}>{item.requesterName ?? "—"}</td>
                      <td className={listTdClass}>{item.assetName ?? "—"}</td>
                      <td className={`${listTdClass} whitespace-nowrap`}>{formatWhen(item.createdAt)}</td>
                      <td className={listTdClass}>{STATE_LABEL[state]}</td>
                      {canEdit ? (
                        <td
                          className={`${listTdClass} sticky right-0 z-10 bg-card group-hover:bg-muted/40`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={deciding}
                              className={cn(
                                "text-primary hover:bg-primary/10 hover:text-primary",
                                !pendingRow && "opacity-40",
                              )}
                              aria-label={`Editar ${item.title}`}
                              title={pendingRow ? "Editar" : "Só uma solicitação pendente pode ser editada"}
                              onClick={(event) => {
                                event.stopPropagation();
                                beginEdit(item);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={deciding}
                              className={cn(
                                "text-destructive hover:bg-destructive/10 hover:text-destructive",
                                !pendingRow && "opacity-40",
                              )}
                              aria-label={`Excluir ${item.title}`}
                              title={pendingRow ? "Excluir" : "Só uma solicitação pendente pode ser excluída"}
                              onClick={(event) => {
                                event.stopPropagation();
                                void remove(item);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination page={query.page} pageSize={LIST_PAGE_SIZE} total={total} pending={navigating} onPageChange={(page) => visit({ page })} />
      </Card>

      <Sheet open={open !== null} onOpenChange={(next) => { if (!next) closeSheet(); }}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{open?.customId ?? "Solicitação"}</SheetTitle>
            <SheetDescription>{open ? STATE_LABEL[requestState(open)] : ""}</SheetDescription>
          </SheetHeader>
          {open ? (
            <div className="space-y-5 px-6 py-5 text-sm">
              <p className="font-semibold">{open.title}</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{open.description || "Sem descrição."}</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Nome</dt><dd className="mt-1">{open.requesterName ?? "—"}</dd></div>
                <div><dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Telefone</dt><dd className="mt-1">{open.requesterPhone ?? "—"}</dd></div>
                <div><dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ativo</dt><dd className="mt-1">{open.assetName ?? "—"}</dd></div>
                <div><dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Local</dt><dd className="mt-1">{open.locationName ?? "—"}</dd></div>
              </dl>
              {open.workOrderCustomId ? <p>Ordem criada: {open.workOrderCustomId}</p> : null}
              {open.cancellationReason ? <p>Motivo da recusa: {open.cancellationReason}</p> : null}
              {error ? <p className="text-destructive">{error}</p> : null}
              {canEdit && requestState(open) === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-9" disabled={deciding} onClick={() => beginEdit(open)}>
                    <Pencil />
                    Editar
                  </Button>
                  <Button type="button" variant="outline" className="h-9 text-destructive" disabled={deciding} onClick={() => void remove(open)}>
                    <Trash2 />
                    Excluir
                  </Button>
                </div>
              ) : null}
              {isAdmin && requestState(open) === "pending" ? (
                <div className="space-y-3">
                  <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da recusa" rows={3} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="h-9" disabled={deciding} onClick={() => void decide("approve")}>Aprovar</Button>
                    <Button type="button" variant="outline" className="h-9" disabled={deciding} onClick={() => void decide("reject")}>Recusar</Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <FormDialog
        open={creating || editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setCreating(false);
            setEditing(null);
          }
        }}
        title={editing ? "Editar solicitação" : "Nova solicitação"}
        description={editing ? "Vale só enquanto a solicitação estiver pendente." : "Peça manutenção para um ativo. O administrador transforma a solicitação em ordem."}
      >
        <RequestForm
          key={editing?.id ?? "new"}
          request={editing}
          assets={assets}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSuccess={() => {
            setCreating(false);
            setEditing(null);
            selection.clear();
            router.refresh();
          }}
        />
      </FormDialog>
      <FormDialog
        open={editor !== null}
        onOpenChange={(next) => {
          if (!next) setEditor(null);
        }}
        title="Completar ordem de serviço"
        description="A solicitação já virou esta ordem. Complete o que faltar."
      >
        {editor ? (
          <WorkOrderForm
            key={editor.order.id}
            order={editor.order}
            locations={editor.locations}
            assets={editor.assets}
            people={editor.people}
            teams={editor.teams}
            checklists={editor.checklists}
            customers={editor.customers}
            onCancel={() => setEditor(null)}
            onSuccess={() => {
              setEditor(null);
              router.refresh();
            }}
          />
        ) : null}
      </FormDialog>
    </div>
  );
}

function RequestForm({
  request,
  assets,
  onCancel,
  onSuccess,
}: {
  request: RequestRecord | null;
  assets: { id: string; name: string }[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = request ? updateRequest : createRequest;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  useEffect(() => {
    if (state?.success) onSuccessRef.current();
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {request ? <input type="hidden" name="id" value={request.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <label className="block space-y-1 text-sm">
        <span>Ativo</span>
        <NativeSelect name="asset_id" required className="h-9" defaultValue={request?.assetId ?? ""}>
          <option value="">Selecione</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </NativeSelect>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Título</span>
        <Input name="title" className="h-9" placeholder="Opcional" defaultValue={request?.title ?? ""} />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Descrição</span>
        <Textarea name="description" required rows={4} defaultValue={request?.description ?? ""} />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="h-9" disabled={pending}>{pending ? "Salvando..." : request ? "Salvar" : "Criar"}</Button>
      </div>
    </form>
  );
}
