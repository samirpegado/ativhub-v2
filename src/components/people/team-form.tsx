"use client";

import { useActionState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { createTeam, updateTeam } from "@/app/(app)/people/actions";
import type { MutationState } from "@/lib/forms/state";
import type { PersonRecord, TeamRecord } from "@/lib/people/queries";

export function TeamForm({
  team,
  people,
  onCancel,
  onSuccess,
}: {
  team?: TeamRecord;
  people: PersonRecord[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = team ? updateTeam : createTeam;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field label="Nome" htmlFor="team_name" required>
        <Input
          id="team_name"
          name="name"
          required
          defaultValue={team?.name}
          className="h-9"
          autoFocus
        />
      </Field>
      <Field label="Descrição" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          defaultValue={team?.description ?? ""}
          rows={3}
        />
      </Field>
      <Field label="Pessoas" htmlFor="member_ids">
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre uma pessoa antes de adicioná-la à equipe.
          </p>
        ) : (
          <div
            id="member_ids"
            className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2"
          >
            {people.map((person) => {
              const name = [person.firstName, person.lastName]
                .filter(Boolean)
                .join(" ");
              return (
                <label
                  key={person.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    name="member_ids"
                    value={person.id}
                    defaultChecked={team?.memberIds.includes(person.id)}
                    className="size-4 accent-primary"
                  />
                  <span>
                    {name}
                    <span className="text-muted-foreground"> · {person.roleName}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Field>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
