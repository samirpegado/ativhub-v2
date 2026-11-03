"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function printQrLabel(
  src: string,
  asset: { name: string; customId: string | null },
) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Etiqueta do QR code");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = "210mm";
  frame.style.height = "297mm";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    frame.remove();
    return;
  }

  const code = asset.customId ? escapeHtml(asset.customId) : "";
  doc.open();
  doc.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>QR ${escapeHtml(asset.name)}</title>
  <style>
    @page { margin: 12mm; }
    body { margin: 0; font-family: sans-serif; color: #172033; }
    .label {
      width: 70mm;
      margin: 8mm auto;
      padding: 4mm;
      border: 1px dashed #c5cad6;
      text-align: center;
      page-break-inside: avoid;
    }
    img { width: 52mm; height: 52mm; }
    .code { margin: 0 0 2mm; font-size: 11pt; letter-spacing: 0.04em; }
    .name { margin: 3mm 0 0; font-size: 13pt; font-weight: 700; line-height: 1.25; }
  </style>
</head>
<body>
  <div class="label">
    ${code ? `<p class="code">${code}</p>` : ""}
    <img src="${src}" alt="" />
    <p class="name">${escapeHtml(asset.name)}</p>
  </div>
</body>
</html>`);
  doc.close();

  window.setTimeout(() => {
    win.focus();
    win.print();
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
  }, 250);
}

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
      width: 640,
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
                if (src && asset) printQrLabel(src, asset);
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
