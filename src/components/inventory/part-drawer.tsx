"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { fetchPartDetail } from "@/app/(app)/inventory/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPartCost, formatQuantity, isLowStock, movementLabel } from "@/lib/inventory/format";
import type { PartDetail, PartRecord } from "@/lib/inventory/queries";
import { workOrderStatusLabel } from "@/lib/work-orders/status";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function PartDrawer({
  partId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  partId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (part: PartRecord) => void;
  onDelete: (part: PartRecord) => void;
}) {
  const [detail, setDetail] = useState<PartDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partId || !open) return;
    setDetail(null);
    setError(null);
    let cancelled = false;
    fetchPartDetail(partId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, partId]);

  if (!open || !partId) return null;
  const part = detail?.part ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{part?.name ?? "Peça"}</SheetTitle>
          <SheetDescription>{part?.description || "Detalhe da peça e movimentos de estoque."}</SheetDescription>
        </SheetHeader>
        {!part ? (
          <div className="flex items-center justify-center py-16">
            {error ? (
              <p className="px-6 text-center text-sm text-destructive">{error}</p>
            ) : (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            )}
          </div>
        ) : (
          <div className="space-y-6 px-6 py-5">
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-9" onClick={() => onEdit(part)}>
                <Pencil />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 text-destructive"
                onClick={() => onDelete(part)}
              >
                <Trash2 />
                Excluir
              </Button>
            </div>
            {part.imageUrl ? (
              // URL assinada do Storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={part.imageUrl} alt="" className="size-24 rounded-md object-cover" />
            ) : null}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Custo" value={formatPartCost(part.cost, part.unit)} />
              <Detail
                label="Quantidade"
                value={
                  isLowStock(part)
                    ? `${formatQuantity(part.quantity, part.unit)} · estoque baixo`
                    : formatQuantity(part.quantity, part.unit)
                }
              />
              <Detail label="Mínimo" value={formatQuantity(part.minQuantity, part.unit)} />
              <Detail label="Código de barras" value={part.barcode ?? "—"} />
              <Detail label="Área" value={part.area ?? "—"} />
              <Detail label="Controle" value={part.nonStock ? "Sem controle de estoque" : "Controla estoque"} />
            </dl>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Movimentos</h3>
              {detail && detail.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum movimento.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail?.movements.map((movement) => (
                    <li key={movement.id} className="flex items-start justify-between gap-3 border-b pb-2">
                      <div>
                        <p className="font-medium">{movementLabel(movement.reason)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatWhen(movement.createdAt)}
                          {movement.workOrderTitle
                            ? ` · ${movement.workOrderCustomId ?? movement.workOrderTitle}`
                            : ""}
                        </p>
                      </div>
                      <span className={movement.quantity < 0 ? "text-destructive" : "text-emerald-700"}>
                        {movement.quantity > 0 ? "+" : ""}
                        {formatQuantity(movement.quantity, part.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Ordens</h3>
              {detail && detail.workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ordem usou esta peça.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail?.workOrders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3">
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {order.customId ?? "—"}
                        </span>{" "}
                        {order.title}
                        <span className="text-muted-foreground"> · {workOrderStatusLabel(order.status)}</span>
                      </span>
                      <span>{formatQuantity(order.quantity, part.unit)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
