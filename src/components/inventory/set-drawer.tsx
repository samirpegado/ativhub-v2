"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { fetchPartSetDetail } from "@/app/(app)/inventory/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPartCost } from "@/lib/inventory/format";
import type { PartSetDetail, PartSetRecord } from "@/lib/inventory/queries";

export function SetDrawer({
  setId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  setId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (set: PartSetRecord) => void;
  onDelete: (set: PartSetRecord) => void;
}) {
  const [detail, setDetail] = useState<PartSetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setId || !open) return;
    setDetail(null);
    setError(null);
    let cancelled = false;
    fetchPartSetDetail(setId).then((result) => {
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
  }, [open, setId]);

  if (!open || !setId) return null;

  const record: PartSetRecord | null = detail
    ? {
        id: detail.id,
        name: detail.name,
        createdAt: detail.createdAt,
        partCount: detail.parts.length,
        totalCost: detail.totalCost,
        partIds: detail.parts.map((part) => part.id),
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{detail?.name ?? "Conjunto"}</SheetTitle>
          <SheetDescription>
            {detail ? `${detail.parts.length} peças · ${formatPartCost(detail.totalCost, null)}` : "Carregando conjunto."}
          </SheetDescription>
        </SheetHeader>
        {!detail ? (
          <div className="flex items-center justify-center py-16">
            {error ? (
              <p className="px-6 text-center text-sm text-destructive">{error}</p>
            ) : (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            )}
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-9" onClick={() => record && onEdit(record)}>
                <Pencil />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 text-destructive"
                onClick={() => record && onDelete(record)}
              >
                <Trash2 />
                Excluir
              </Button>
            </div>
            {detail.parts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma peça neste conjunto.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.parts.map((part) => (
                  <li key={part.id} className="flex items-center justify-between gap-3 border-b pb-2">
                    <span className="font-medium">{part.name}</span>
                    <span className="text-muted-foreground">{formatPartCost(part.cost, part.unit)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
