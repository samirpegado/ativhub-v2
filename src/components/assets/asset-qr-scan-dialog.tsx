"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { resolveAssetScan } from "@/app/(app)/assets/scan-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AssetQrScanButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        aria-label="Ler QR code do ativo"
        onClick={() => setOpen(true)}
      >
        <QrCode />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ler QR code</DialogTitle>
            <DialogDescription>Aponte a câmera para o QR code do ativo.</DialogDescription>
          </DialogHeader>
          {open ? (
            <QrCamera
              onFound={(id) => {
                setOpen(false);
                router.push(`/assets/${id}`);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QrCamera({ onFound }: { onFound: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let active = true;
    const handled = { current: false };

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!active) return;
      const current = new Html5Qrcode("asset-qr-reader", false);
      scanner = current;
      try {
        await current.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          async (text) => {
            if (handled.current) return;
            handled.current = true;
            const result = await resolveAssetScan(text);
            if (!active) return;
            if ("error" in result) {
              handled.current = false;
              setError(result.error);
              return;
            }
            onFoundRef.current(result.id);
          },
          () => undefined,
        );
        if (!active) {
          await current.stop().catch(() => undefined);
          current.clear();
        }
      } catch {
        if (active) setCameraError("Não foi possível abrir a câmera. Permita o acesso e tente de novo.");
      }
    })();

    return () => {
      active = false;
      const current = scanner;
      if (!current) return;
      current.stop().catch(() => undefined).finally(() => current.clear());
    };
  }, [attempt]);

  return (
    <div className="space-y-3">
      <div id="asset-qr-reader" className="overflow-hidden rounded-xl bg-black [&_video]:w-full" />
      {cameraError || error ? <p className="text-sm text-destructive">{cameraError ?? error}</p> : null}
      {cameraError ? (
        <Button type="button" variant="outline" className="h-9 w-full" onClick={() => { setCameraError(null); setError(null); setAttempt((value) => value + 1); }}>
          Tentar de novo
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">O ativo abre assim que o código for lido.</p>
      )}
    </div>
  );
}
