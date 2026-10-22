"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { submitPublicRequest } from "@/app/s/actions";
import { PhoneInput } from "@/components/forms/phone-input";
import { Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PublicAsset } from "@/app/s/actions";

export function PublicRequestForm({ asset }: { asset: PublicAsset }) {
  const [state, formAction, pending] = useActionState(submitPublicRequest, undefined);

  if (state?.success) {
    return (
      <Card className="mx-auto w-full max-w-md gap-3 p-6">
        <h1 className="text-xl font-bold">Solicitação enviada</h1>
        <p className="text-sm text-muted-foreground">A equipe vai ver o pedido de {asset.name}.</p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md gap-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Solicitar manutenção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {asset.customId ? `${asset.customId} · ` : ""}
          {asset.name}
          {asset.locationName ? ` · ${asset.locationName}` : ""}
        </p>
      </div>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="asset_id" value={asset.id} />
        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <Field label="Nome" htmlFor="name" required>
          <Input id="name" name="name" required className="h-9" autoFocus />
        </Field>
        <Field label="Telefone" htmlFor="phone" required>
          <PhoneInput id="phone" name="phone" required className="h-9" />
        </Field>
        <Field label="O que aconteceu" htmlFor="description" required>
          <Textarea id="description" name="description" required rows={4} />
        </Field>
        <Field label="Código de barras" htmlFor="barcode" hint="Preencha só se o equipamento for outro.">
          <Input id="barcode" name="barcode" className="h-9" />
        </Field>
        <Field label="PIN da empresa" htmlFor="pin" required>
          <Input id="pin" name="pin" inputMode="numeric" autoComplete="off" required minLength={4} maxLength={6} className="h-9" />
        </Field>
        <Button type="submit" className="h-9 w-full font-semibold" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Enviar
        </Button>
      </form>
    </Card>
  );
}
