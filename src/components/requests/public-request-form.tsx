"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { submitPublicRequest } from "@/app/s/actions";
import { PhoneInput } from "@/components/forms/phone-input";
import { Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PublicRequestForm({
  token,
  onCancel,
}: {
  token: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(submitPublicRequest, undefined);

  if (state?.success) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Solicitação enviada</p>
        <p className="text-sm text-muted-foreground">A equipe vai ver o pedido.</p>
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border p-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <h2 className="font-semibold">Nova solicitação</h2>
        <p className="text-sm text-muted-foreground">Descreva o que precisa de manutenção.</p>
      </div>
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
      <div className="flex gap-2">
        <Button type="submit" className="h-9 font-semibold" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Enviar
        </Button>
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
