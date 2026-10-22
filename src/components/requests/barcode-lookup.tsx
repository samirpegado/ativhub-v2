"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupPublicAsset } from "@/app/s/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function BarcodeLookup() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="mx-auto w-full max-w-md gap-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Solicitar manutenção</h1>
        <p className="mt-1 text-sm text-muted-foreground">Digite o código de barras do equipamento.</p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await lookupPublicAsset({ barcode: code });
            if ("error" in result) {
              setError(result.error);
              return;
            }
            router.push(`/s/${result.asset.id}`);
          });
        }}
      >
        <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código de barras" className="h-9" autoFocus required />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-9 w-full font-semibold" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Continuar
        </Button>
      </form>
    </Card>
  );
}
