"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { loadAssetDetailAction } from "@/app/(app)/assets/detail-actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AssetDetail } from "@/lib/assets/detail";
import { assetStatusClass, assetStatusLabel } from "@/lib/assets/status";
import { formatBrl } from "@/lib/money/brl";
import { formatDuration } from "@/lib/work-orders/activity";
import { workOrderStatusLabel } from "@/lib/work-orders/status";
import { cn } from "@/lib/utils";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatDay(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function AssetDrawer({
  assetId,
  open,
  canEdit,
  onOpenChange,
  onEdit,
}: {
  assetId: string | null;
  open: boolean;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !assetId) return;
    startTransition(async () => {
      const result = await loadAssetDetailAction(assetId);
      if ("error" in result) {
        setDetail(null);
        setError(result.error);
        return;
      }
      setError(null);
      setDetail(result.detail);
    });
  }, [assetId, open]);

  const asset = detail?.asset;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{asset?.name ?? "Ativo"}</SheetTitle>
          <SheetDescription>
            {asset?.customId ? `${asset.customId} · ` : ""}
            Histórico de manutenção e custo acumulado.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {pending && !asset ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando…
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {asset && detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", assetStatusClass(asset.status))}>
                  {assetStatusLabel(asset.status)}
                </span>
                {asset.categoryName ? (
                  <span className="text-sm text-muted-foreground">{asset.categoryName}</span>
                ) : null}
                {canEdit ? (
                  <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => onEdit(asset.id)}>
                    <Pencil />
                    Editar
                  </Button>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Tempo parado" value={formatDuration(detail.downtimeSeconds)} />
                <Metric
                  label="Disponibilidade"
                  value={detail.availability == null ? "—" : `${Math.round(detail.availability * 1000) / 10}%`}
                />
                <Metric label="Ordens" value={String(detail.workOrderCount)} />
                <Metric label="Custo de manutenção" value={formatBrl(detail.maintenanceCost)} />
                <Metric label="MTTR" value={detail.mttrSeconds == null ? "—" : formatDuration(detail.mttrSeconds)} />
                <Metric label="MTBF" value={detail.mtbfSeconds == null ? "—" : formatDuration(detail.mtbfSeconds)} />
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Localização</dt>
                  <dd className="mt-1">{asset.locationName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Local de instalação</dt>
                  <dd className="mt-1">{asset.area ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Custo de aquisição</dt>
                  <dd className="mt-1">{asset.acquisitionCost == null ? "—" : formatBrl(asset.acquisitionCost)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Em serviço desde</dt>
                  <dd className="mt-1">{formatDay(asset.inServiceDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fim da garantia</dt>
                  <dd className="mt-1">{formatDay(asset.warrantyExpirationDate)}</dd>
                </div>
              </dl>
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Histórico</h2>
                {detail.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma ordem ou parada registrada.</p>
                ) : (
                  <ol className="space-y-3 border-l pl-4">
                    {detail.events.map((event) =>
                      event.kind === "downtime" ? (
                        <li key={`down-${event.id}`} className="relative">
                          <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-destructive" />
                          <p className="text-xs text-muted-foreground">{formatWhen(event.at)}</p>
                          <p className="text-sm font-medium">
                            Parada · {formatDuration(event.durationSeconds)}
                            {event.open ? " · em andamento" : ""}
                          </p>
                        </li>
                      ) : (
                        <li key={event.id} className="relative">
                          <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" />
                          <p className="text-xs text-muted-foreground">
                            {formatWhen(event.at)} · {event.type === "PREVENTIVE" ? "Preventiva" : "Corretiva"} ·{" "}
                            {workOrderStatusLabel(event.status)}
                          </p>
                          <p className="text-sm font-medium">
                            {event.customId ? `${event.customId} · ` : ""}
                            {event.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Peças {formatBrl(event.partsCost)} · Mão de obra {formatBrl(event.laborCost)}
                          </p>
                        </li>
                      ),
                    )}
                  </ol>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
