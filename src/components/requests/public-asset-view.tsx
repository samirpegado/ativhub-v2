"use client";

import { useEffect, useState, useTransition } from "react";
import { FileDown, Loader2 } from "lucide-react";
import {
  loadPublicOverview,
  loadPublicReport,
  unlockPublicAsset,
} from "@/app/s/actions";
import { PublicRequestForm } from "@/components/requests/public-request-form";
import { printPublicWorkOrderReport } from "@/components/requests/public-report";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBrl } from "@/lib/money/brl";
import type { PublicAsset, PublicHistoryItem, PublicOverview } from "@/lib/requests/public";
import { workOrderStatusLabel, workOrderTypeLabel } from "@/lib/work-orders/status";

function storageKey(assetId: string) {
  return `ativhub.public.${assetId}`;
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function HistoryList({
  items,
  pendingId,
  onPrint,
}: {
  items: PublicHistoryItem[];
  pendingId: string | null;
  onPrint: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {item.customId ? `${item.customId} · ` : ""}
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDay(item.at)} · {workOrderTypeLabel(item.type)} · {workOrderStatusLabel(item.status)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={pendingId === item.id}
              onClick={() => onPrint(item.id)}
            >
              {pendingId === item.id ? <Loader2 className="animate-spin" /> : <FileDown />}
              PDF
            </Button>
          </div>
          {item.description ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Peças {formatBrl(item.partsCost)} · Mão de obra {formatBrl(item.laborCost)}
            {item.billingMode === "FIXED" ? ` · Serviço ${formatBrl(item.serviceCost)}` : ""}
            {" · "}
            Total {formatBrl(item.total)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function PublicAssetView({ asset }: { asset: PublicAsset }) {
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<PublicOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!asset.locationName) {
      setBooting(false);
      return;
    }
    const stored = window.sessionStorage.getItem(storageKey(asset.id));
    if (!stored) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const result = await loadPublicOverview(stored);
      if (cancelled) return;
      if ("error" in result) {
        window.sessionStorage.removeItem(storageKey(asset.id));
      } else {
        setToken(stored);
        setOverview(result);
      }
      setBooting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [asset.id, asset.locationName]);

  if (!asset.locationName) {
    return (
      <Card className="gap-3 p-6">
        <h1 className="text-xl font-bold">Equipamento sem localização</h1>
        <p className="text-sm text-muted-foreground">
          {asset.customId ? `${asset.customId} · ` : ""}
          {asset.name} não está ligado a uma localização. Procure o gestor para solicitar manutenção.
        </p>
      </Card>
    );
  }

  function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await unlockPublicAsset(asset.id, pin);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      window.sessionStorage.setItem(storageKey(asset.id), result.token);
      setToken(result.token);
      setOverview({ asset: result.asset, history: result.history });
    });
  }

  function printOrder(workOrderId: string) {
    if (!token) return;
    setError(null);
    setPrintingId(workOrderId);
    startTransition(async () => {
      const result = await loadPublicReport(token, workOrderId);
      setPrintingId(null);
      if ("error" in result) {
        if (result.error.includes("Sessão")) {
          window.sessionStorage.removeItem(storageKey(asset.id));
          setToken(null);
          setOverview(null);
        }
        setError(result.error);
        return;
      }
      printPublicWorkOrderReport(result.report);
    });
  }

  if (booting && !overview) {
    return (
      <Card className="items-center p-6">
        <Loader2 className="animate-spin" />
      </Card>
    );
  }

  if (!overview || !token) {
    return (
      <Card className="gap-4 p-6">
        <div>
          <h1 className="text-xl font-bold">Acessar equipamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {asset.customId ? `${asset.customId} · ` : ""}
            {asset.name} · {asset.locationName}
          </p>
        </div>
        <form onSubmit={unlock} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium">PIN do cliente</label>
            <Input
              id="pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              required
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-9 max-w-32 font-mono tracking-widest"
              placeholder="0000"
              autoFocus
            />
          </div>
          <Button type="submit" className="h-9 w-full font-semibold" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Entrar
          </Button>
        </form>
      </Card>
    );
  }

  const shown = overview.asset;

  return (
    <Card className="gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {shown.customId ? `${shown.customId} · ` : ""}
            {shown.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{shown.locationName}</p>
        </div>
        <Button type="button" className="h-9 font-semibold" onClick={() => setRequestOpen(true)}>
          Nova solicitação
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {requestOpen ? (
        <PublicRequestForm token={token} onCancel={() => setRequestOpen(false)} />
      ) : null}
      <div className="space-y-3">
        <h2 className="font-semibold">Manutenções</h2>
        <HistoryList items={overview.history} pendingId={printingId} onPrint={printOrder} />
      </div>
    </Card>
  );
}
