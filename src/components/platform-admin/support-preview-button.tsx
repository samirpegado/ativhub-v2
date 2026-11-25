"use client";

import { useActionState } from "react";
import { startSupportPreview } from "@/app/(platform)/admin/support/actions";
import { Button } from "@/components/ui/button";

export function SupportPreviewButton({ tenantId, membershipId, personName }: {
  tenantId: string;
  membershipId: string;
  personName: string;
}) {
  const [state, action, pending] = useActionState(startSupportPreview, undefined);

  return (
    <form action={action} aria-busy={pending} className="space-y-1.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending} aria-label={`Ver como ${personName}`}>
        {pending ? "Abrindo…" : "Ver como"}
      </Button>
      {state?.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
