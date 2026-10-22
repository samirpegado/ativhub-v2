"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
    const origin = window.location.origin;
    void QRCode.toDataURL(`${origin}/s/${assetId}`, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((src) => {
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
        <div className="flex justify-center py-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
