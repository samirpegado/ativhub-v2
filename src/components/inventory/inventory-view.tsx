"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deletePart, deletePartSet } from "@/app/(app)/inventory/actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { PartDrawer } from "@/components/inventory/part-drawer";
import { PartForm } from "@/components/inventory/part-form";
import { SetDrawer } from "@/components/inventory/set-drawer";
import { SetForm } from "@/components/inventory/set-form";
import { TablePagination } from "@/components/lists/table-pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import type { MutationState } from "@/lib/forms/state";
import { formatPartCost, formatQuantity, isLowStock } from "@/lib/inventory/format";
import {
  STOCK_FILTERS,
  inventoryHref,
  type InventoryListQuery,
} from "@/lib/inventory/list-params";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { PartOption, PartRecord, PartSetRecord } from "@/lib/inventory/queries";
import { cn } from "@/lib/utils";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function InventoryView({
  query,
  tenantId,
  parts = [],
  total = 0,
  totalAll = 0,
  sets = [],
  setTotal = 0,
  setTotalAll = 0,
  partOptions = [],
}: {
  query: InventoryListQuery;
  tenantId: string;
  parts?: PartRecord[];
  total?: number;
  totalAll?: number;
  sets?: PartSetRecord[];
  setTotal?: number;
  setTotalAll?: number;
  partOptions?: PartOption[];
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [editingPart, setEditingPart] = useState<PartRecord | "new" | null>(null);
  const [editingSet, setEditingSet] = useState<PartSetRecord | "new" | null>(null);
  const [openPartId, setOpenPartId] = useState<string | null>(null);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [partState, partDelete, partPending] = useActionState<MutationState, FormData>(
    deletePart,
    undefined,
  );
  const [setState, setDelete, setPending] = useActionState<MutationState, FormData>(
    deletePartSet,
    undefined,
  );

  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.search) return;
    const handle = window.setTimeout(() => {
      startNavigation(() => {
        router.replace(inventoryHref({ ...query, search: trimmed, page: 1 }), { scroll: false });
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, router, search]);

  function visit(next: Partial<InventoryListQuery> & { page?: number }) {
    startNavigation(() => {
      router.replace(
        inventoryHref({
          search,
          stock: query.stock,
          page: query.page,
          sets: query.sets,
          ...next,
        }),
        { scroll: false },
      );
    });
  }

  const tab = query.sets ? "sets" : "parts";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {(
            [
              ["parts", "Peças"],
              ["sets", "Conjuntos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => visit({ sets: id === "sets", stock: null, page: 1 })}
              className={cn(
                "border-b-2 px-3 py-2 text-sm",
                tab === id
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          className="h-9 font-semibold"
          onClick={() => (query.sets ? setEditingSet("new") : setEditingPart("new"))}
        >
          <Plus />
          {query.sets ? "Conjunto" : "Peça"}
        </Button>
      </div>

      <Card
        className={cn(
          "items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]",
          navigating && "opacity-70",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {query.sets ? null : (
            <NativeSelect
              className="h-9 w-48 shrink-0"
              value={query.stock ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                visit({
                  stock: value === "low" || value === "ok" || value === "non_stock" ? value : null,
                  page: 1,
                });
              }}
            >
              <option value="">Todo o estoque</option>
              {STOCK_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          )}
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
        {partState?.error || setState?.error ? (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{partState?.error ?? setState?.error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <Separator />
        {query.sets ? (
          sets.length === 0 ? (
            <Empty
              title={
                setTotalAll === 0
                  ? "Conjuntos agrupam peças usadas juntas"
                  : "Nenhum resultado para a busca."
              }
              hint={
                setTotalAll === 0
                  ? "Pressione o botão para criar um conjunto"
                  : "Tente outro termo."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted">
                  <tr className="text-muted-foreground">
                    {["Nome", "Peças", "Custo total", "Criado em"].map((header) => (
                      <th key={header} className="px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                        {header}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                      onClick={() => setOpenSetId(item.id)}
                    >
                      <td className="px-4 py-3 font-semibold">{item.name}</td>
                      <td className="px-4 py-3">{item.partCount}</td>
                      <td className="px-4 py-3">{formatPartCost(item.totalCost, null)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatWhen(item.createdAt)}</td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <RowActions
                          label={item.name}
                          pending={setPending}
                          action={setDelete}
                          id={item.id}
                          onEdit={() => setEditingSet(item)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : parts.length === 0 ? (
          <Empty
            title={
              totalAll === 0
                ? "Peças controlam o estoque usado nas ordens"
                : "Nenhum resultado para a busca."
            }
            hint={
              totalAll === 0
                ? "Pressione o botão para criar uma peça"
                : "Tente outro termo ou ajuste o filtro."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  {["Nome", "Custo", "Quantidade", "Código de barras", "Área", "Descrição"].map(
                    (header) => (
                      <th key={header} className="px-4 py-3 text-xs font-semibold tracking-wide uppercase">
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
                {parts.map((part) => (
                  <tr
                    key={part.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                    onClick={() => setOpenPartId(part.id)}
                  >
                    <td className="px-4 py-3 font-semibold">{part.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPartCost(part.cost, part.unit)}</td>
                    <td className={cn("px-4 py-3 whitespace-nowrap", isLowStock(part) && "text-destructive")}>
                      {formatQuantity(part.quantity, part.unit)}
                      {isLowStock(part) ? " · baixo" : ""}
                    </td>
                    <td className="px-4 py-3">{part.barcode ?? "—"}</td>
                    <td className="px-4 py-3">{part.area ?? "—"}</td>
                    <td className="max-w-xs truncate px-4 py-3">{part.description ?? "—"}</td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <RowActions
                        label={part.name}
                        pending={partPending}
                        action={partDelete}
                        id={part.id}
                        onEdit={() => setEditingPart(part)}
                      />
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
          total={query.sets ? setTotal : total}
          pending={navigating}
          onPageChange={(page) => visit({ page })}
        />
      </Card>

      <FormDialog
        open={editingPart !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPart(null);
        }}
        title={editingPart && editingPart !== "new" ? "Editar peça" : "Nova peça"}
        description="O nome é obrigatório. A quantidade inicial entra como ajuste de estoque."
      >
        {editingPart ? (
          <PartForm
            key={editingPart === "new" ? "new" : editingPart.id}
            part={editingPart === "new" ? undefined : editingPart}
            tenantId={tenantId}
            onCancel={() => setEditingPart(null)}
            onSuccess={() => setEditingPart(null)}
          />
        ) : null}
      </FormDialog>

      <FormDialog
        open={editingSet !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSet(null);
        }}
        title={editingSet && editingSet !== "new" ? "Editar conjunto" : "Novo conjunto"}
        description="Um conjunto agrupa peças usadas juntas. O custo é a soma dos custos unitários."
      >
        {editingSet ? (
          <SetForm
            key={editingSet === "new" ? "new-set" : editingSet.id}
            set={editingSet === "new" ? undefined : editingSet}
            parts={partOptions}
            onCancel={() => setEditingSet(null)}
            onSuccess={() => setEditingSet(null)}
          />
        ) : null}
      </FormDialog>

      <PartDrawer
        partId={openPartId}
        open={openPartId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPartId(null);
        }}
        onEdit={(part) => {
          setOpenPartId(null);
          setEditingPart(part);
        }}
        onDelete={(part) => {
          if (!window.confirm(`Excluir a peça "${part.name}"?`)) return;
          setOpenPartId(null);
          const data = new FormData();
          data.set("id", part.id);
          partDelete(data);
        }}
      />

      <SetDrawer
        setId={openSetId}
        open={openSetId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenSetId(null);
        }}
        onEdit={(item) => {
          setOpenSetId(null);
          setEditingSet(item);
        }}
        onDelete={(item) => {
          if (!window.confirm(`Excluir o conjunto "${item.name}"?`)) return;
          setOpenSetId(null);
          const data = new FormData();
          data.set("id", item.id);
          setDelete(data);
        }}
      />
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="max-w-md text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function RowActions({
  label,
  pending,
  action,
  id,
  onEdit,
}: {
  label: string;
  pending: boolean;
  action: (payload: FormData) => void;
  id: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-primary hover:bg-primary/10 hover:text-primary"
        aria-label={`Editar ${label}`}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </Button>
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm(`Excluir "${label}"?`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remover ${label}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </form>
    </div>
  );
}
