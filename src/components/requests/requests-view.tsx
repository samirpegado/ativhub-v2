"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Plus, Search, User, Wrench } from "lucide-react";
import { deleteRequests } from "@/app/(app)/requests/actions";
import { CardListSkeleton } from "@/components/loading/card-list-skeleton";
import { TableSkeleton } from "@/components/loading/table-skeleton";
import { RequestForm } from "@/components/requests/request-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { CardFact, RecordCard, RecordCardList, mobileCardClass } from "@/components/lists/record-card";
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
import type { AssetPickerHit } from "@/lib/assets/picker";
import { isMobile } from "@/lib/app/is-mobile";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import {
  REQUEST_STATUSES,
  requestHref,
  type RequestListQuery,
} from "@/lib/requests/list-params";
import { requestState, type RequestRecord } from "@/lib/requests/payload";
import { cn } from "@/lib/utils";

const STATE_LABEL = {
  pending: "Pendente",
  treating: "Em tratamento",
  approved: "Aprovada",
  rejected: "Recusada",
};

const STATE_CHIP = {
  pending: "bg-[#eef0f3] text-[#6b7280]",
  treating: "bg-[#fdf1dc] text-[#b45309]",
  approved: "bg-[#e8f6ec] text-[#15803d]",
  rejected: "bg-[#fde8e8] text-[#b91c1c]",
};

function whenParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(date),
  };
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function RequestsView({
  query,
  canEdit,
  isAdmin,
  tenantId,
  items,
  total,
  totalAll,
  presetAssetId = null,
  lockedAsset = null,
}: {
  query: RequestListQuery;
  canEdit: boolean;
  isAdmin: boolean;
  tenantId: string;
  items: RequestRecord[];
  total: number;
  totalAll: number;
  presetAssetId?: string | null;
  lockedAsset?: AssetPickerHit | null;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [creating, setCreating] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const rowIds = useMemo(() => (canEdit ? items.map((item) => item.id) : []), [canEdit, items]);
  const deletableIds = useMemo(
    () => items.filter((item) => {
      const state = requestState(item);
      if (state === "pending" || state === "treating") return true;
      return isAdmin && state === "approved";
    }).map((item) => item.id),
    [isAdmin, items],
  );
  const deletableSet = useMemo(() => new Set(deletableIds), [deletableIds]);
  const approvedSet = useMemo(
    () => new Set(items.filter((item) => requestState(item) === "approved").map((item) => item.id)),
    [items],
  );
  const selection = useRowSelection(rowIds);
  const presetHandled = useRef<string | null>(null);

  useEffect(() => {
    if (!presetAssetId) {
      presetHandled.current = null;
      return;
    }
    if (!canEdit || presetHandled.current === presetAssetId) return;
    presetHandled.current = presetAssetId;
    setCreating(true);
  }, [canEdit, presetAssetId]);

  function closeCreate(open: boolean) {
    setCreating(open);
    if (open || !presetAssetId) return;
    startNavigation(() => {
      router.replace(requestHref(query), { scroll: false });
    });
  }

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

  return (
    <div className="space-y-3">
      <Card className="items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]">
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
            <Button type="button" className="h-9 font-semibold" onClick={() => closeCreate(true)}>
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
                  const chosen = selection.ids.filter((id) => deletableSet.has(id));
                  const approved = chosen.filter((id) => approvedSet.has(id)).length;
                  if (chosen.length === 1 && approved === 1) {
                    return "Excluir a solicitação aprovada? A ordem de serviço criada permanece.";
                  }
                  if (approved > 0) {
                    return `Excluir ${chosen.length} solicitações? As ordens de serviço já criadas permanecem.`;
                  }
                  return chosen.length === 1
                    ? "Excluir a solicitação selecionada?"
                    : `Excluir ${chosen.length} solicitações?`;
                },
                ...(selection.ids.some((id) => deletableSet.has(id))
                  ? {
                      run: async (ids: string[]) => {
                        const chosen = ids.filter((id) => deletableSet.has(id));
                        const result = await deleteRequests(chosen);
                        if (result && !result.error) router.refresh();
                        return result;
                      },
                    }
                  : {
                      onSelect: () =>
                        setListError(
                          isAdmin
                            ? "Solicitações recusadas não podem ser excluídas."
                            : "Só solicitações pendentes ou em tratamento podem ser excluídas.",
                        ),
                    }),
              },
            ]}
          />
        ) : null}
        <Separator />
        {navigating ? (
          isMobile ? <CardListSkeleton /> : <TableSkeleton columns={5} />
        ) : items.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="max-w-md text-sm font-medium">
              {totalAll === 0 ? "Solicitações feitas pelo QR do ativo aparecem aqui" : "Nenhum resultado para a busca."}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalAll === 0 ? "A pessoa na frente do equipamento pede manutenção sem login." : "Tente outro termo ou ajuste o filtro."}
            </p>
          </div>
        ) : isMobile ? (
          <RecordCardList>
            {items.map((item) => {
              const state = requestState(item);
              const when = whenParts(item.createdAt);
              return (
                <RecordCard
                  key={item.id}
                  href={`/requests/${item.id}`}
                  label={`Abrir ${item.title}`}
                  contentClassName="gap-0"
                  className={mobileCardClass}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className={cn("truncate text-xs tracking-wide text-[#6b7280]", item.readAt ? "font-semibold" : "font-bold text-[#1a1f2b]")}>
                      {item.customId ?? "—"}
                    </span>
                    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold", STATE_CHIP[state])}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {STATE_LABEL[state]}
                    </span>
                  </div>
                  <h3 className="my-2 text-base leading-snug font-bold text-[#1a1f2b]">{item.title}</h3>
                  <div className="grid gap-2 border-t border-[#e6e8ec] py-3">
                    <CardFact icon={<Wrench strokeWidth={1.8} />} label="Ativo">
                      {item.assetName ?? "—"}
                    </CardFact>
                    <CardFact icon={<MapPin strokeWidth={1.8} />} label="Localização">
                      {item.locationName ?? "—"}
                    </CardFact>
                    <CardFact icon={<Calendar strokeWidth={1.8} />} label="Quando">
                      {when ? (
                        <span>
                          <b>{when.day}</b>
                          {" · "}
                          {when.time}
                        </span>
                      ) : (
                        <span className="text-[#6b7280]">—</span>
                      )}
                    </CardFact>
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#e6e8ec] pt-3 text-[#6b7280]">
                    <User className="size-4 shrink-0" strokeWidth={1.8} />
                    <span className="truncate text-[12.5px] text-[#374151]">{item.requesterName ?? "—"}</span>
                  </div>
                </RecordCard>
              );
            })}
          </RecordCardList>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
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
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const state = requestState(item);
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "relative cursor-pointer border-b last:border-0 hover:bg-muted/40",
                        item.readAt ? "font-normal" : "font-bold",
                      )}
                    >
                      {canEdit ? (
                        <td className={`${listTdClass} relative z-10`} onPointerDown={(event) => event.stopPropagation()}>
                          <RowCheckbox
                            checked={selection.isSelected(item.id)}
                            label={`Selecionar ${item.title}`}
                            onChange={() => selection.toggle(item.id)}
                          />
                        </td>
                      ) : null}
                      <td className={listTdIdClass}>
                        <Link href={`/requests/${item.id}`} className="absolute inset-0 z-0" aria-label={`Abrir ${item.title}`} />
                        {item.customId ?? "—"}
                      </td>
                      <td className={listTdClass}>{item.requesterName ?? "—"}</td>
                      <td className={listTdClass}>{item.assetName ?? "—"}</td>
                      <td className={`${listTdClass} whitespace-nowrap`}>{formatWhen(item.createdAt)}</td>
                      <td className={listTdClass}>{STATE_LABEL[state]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination page={query.page} pageSize={LIST_PAGE_SIZE} total={total} pending={navigating} onPageChange={(page) => visit({ page })} />
      </Card>

      <FormDialog
        open={creating}
        onOpenChange={closeCreate}
        title="Nova solicitação"
        description="Peça manutenção para um ativo. O administrador transforma a solicitação em ordem."
      >
        {creating ? (
          <RequestForm
            tenantId={tenantId}
            assetId={presetAssetId}
            lockedAsset={lockedAsset}
            onCancel={() => closeCreate(false)}
            onSuccess={() => {
              closeCreate(false);
              selection.clear();
              router.refresh();
            }}
          />
        ) : null}
      </FormDialog>
    </div>
  );
}
