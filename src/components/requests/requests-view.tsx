"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { approveRequest, rejectRequest } from "@/app/(app)/requests/actions";
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
  items,
  total,
  totalAll,
}: {
  query: RequestListQuery;
  canEdit: boolean;
  items: RequestRecord[];
  total: number;
  totalAll: number;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [open, setOpen] = useState<RequestRecord | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  async function decide(kind: "approve" | "reject") {
    if (!open) return;
    setPending(true);
    setError(null);
    const result = kind === "approve" ? await approveRequest(open.id) : await rejectRequest(open.id, reason);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOpen(null);
    setReason("");
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
        </div>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  {["Código", "Solicitante", "Ativo", "Quando", "Situação"].map((header) => (
                    <th key={header} className="px-4 py-3 text-xs font-semibold tracking-wide uppercase">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const state = requestState(item);
                  return (
                    <tr key={item.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => { setOpen(item); setReason(""); setError(null); }}>
                      <td className="px-4 py-3 font-semibold">{item.customId ?? "—"}</td>
                      <td className="px-4 py-3">{item.requesterName ?? "—"}</td>
                      <td className="px-4 py-3">{item.assetName ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatWhen(item.createdAt)}</td>
                      <td className="px-4 py-3">{STATE_LABEL[state]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination page={query.page} pageSize={LIST_PAGE_SIZE} total={total} pending={navigating} onPageChange={(page) => visit({ page })} />
      </Card>

      <Sheet open={open !== null} onOpenChange={(next) => { if (!next) setOpen(null); }}>
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
                <div className="space-y-3">
                  <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da recusa" rows={3} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="h-9" disabled={pending} onClick={() => void decide("approve")}>Aprovar</Button>
                    <Button type="button" variant="outline" className="h-9" disabled={pending} onClick={() => void decide("reject")}>Recusar</Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
