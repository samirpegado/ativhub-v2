"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { printQrLabels, qrDataUrl } from "@/components/assets/print-qr-labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AssetQrDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: { id: string; name: string; customId: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const assetId = asset?.id ?? null;
  const [image, setImage] = useState<{ id: string; src: string } | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    void qrDataUrl(assetId).then((src) => {
      if (!cancelled) setImage({ id: assetId, src });
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const src = image?.id === assetId ? image.src : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code</DialogTitle>
          <DialogDescription>
            {asset?.customId ? `${asset.customId} · ` : ""}
            {asset?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {src ? (
            // Data URL gerada no cliente; next/image não aceita esse src.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              width={240}
              height={240}
              alt={asset ? `QR code de ${asset.name}` : "QR code do ativo"}
              className="size-60"
            />
          ) : (
            <div className="size-60" />
          )}
          <p className="text-center text-sm text-muted-foreground">
            Imprima e cole no equipamento. A leitura abre a página do ativo.
          </p>
          <div className="flex w-full gap-2">
            <Button
              type="button"
              className="h-9 flex-1 font-semibold"
              disabled={!src || !asset}
              onClick={() => {
                if (src && asset) {
                  printQrLabels([{ src, name: asset.name, customId: asset.customId }]);
                }
              }}
            >
              <Printer />
              Imprimir
            </Button>
            {assetId ? (
              <Button asChild variant="outline" className="h-9 flex-1">
                <a href={`/s/${assetId}`}>Abrir página</a>
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
