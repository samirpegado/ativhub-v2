"use client";

import { useActionState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { createPartSet, updatePartSet } from "@/app/(app)/inventory/actions";
import type { MutationState } from "@/lib/forms/state";
import { formatPartCost } from "@/lib/inventory/format";
import type { PartOption, PartSetRecord } from "@/lib/inventory/queries";

export function SetForm({
  set,
  parts,
  onCancel,
  onSuccess,
}: {
  set?: PartSetRecord;
  parts: PartOption[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = set ? updatePartSet : createPartSet;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);
  const selected = new Set(set?.partIds ?? []);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {set ? <input type="hidden" name="id" value={set.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Nome" htmlFor="set_name" required>
        <Input id="set_name" name="name" required defaultValue={set?.name ?? ""} className="h-9" />
      </Field>
      <Field label="Peças">
        {parts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre uma peça antes de montar o conjunto.</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
            {parts.map((part) => (
              <label key={part.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="part_id"
                    value={part.id}
                    defaultChecked={selected.has(part.id)}
                    className="size-4 rounded border"
                  />
                  {part.name}
                </span>
                <span className="text-muted-foreground">{formatPartCost(part.cost, part.unit)}</span>
              </label>
            ))}
          </div>
        )}
      </Field>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
