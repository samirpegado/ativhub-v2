"use client";

import { useActionState, useState } from "react";
import { startSupportPreview } from "@/app/(platform)/admin/support/actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SupportPreviewDialog({ tenantId, membershipId, personName }: {
  tenantId: string;
  membershipId: string;
  personName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`Ver como ${personName}`}>
        Ver como
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={`Ver como ${personName}`}
        description="Abra o painel da pessoa em uma sessão de suporte de 15 minutos, somente para consulta."
      >
        {open ? <SupportPreviewForm tenantId={tenantId} membershipId={membershipId} /> : null}
      </FormDialog>
    </>
  );
}

function SupportPreviewForm({ tenantId, membershipId }: { tenantId: string; membershipId: string }) {
  const [state, action, pending] = useActionState(startSupportPreview, undefined);
  const reasonId = `support-reason-${membershipId}`;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      {state?.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
      <div className="space-y-1.5">
        <Label htmlFor={reasonId}>Motivo da visualização</Label>
        <Textarea id={reasonId} name="reason" minLength={3} maxLength={300} required />
      </div>
      <Button size="lg" type="submit" disabled={pending}>
        {pending ? "Abrindo…" : "Abrir visualização"}
      </Button>
    </form>
  );
}
