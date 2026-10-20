"use client";

import { useActionState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { PhoneInput } from "@/components/forms/phone-input";
import { createPerson, updatePerson } from "@/app/(app)/people/actions";
import type { MutationState } from "@/lib/forms/state";
import type { PersonRecord, RoleOption } from "@/lib/people/queries";

export function PersonForm({
  person,
  roles,
  onCancel,
  onSuccess,
}: {
  person?: PersonRecord;
  roles: RoleOption[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = person ? updatePerson : createPerson;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  const roleOptions =
    person && !roles.some((role) => role.code === person.roleCode)
      ? [
          ...roles,
          {
            id: person.roleId,
            code: person.roleCode,
            name: person.roleName,
            description: person.roleDescription,
          },
        ]
      : roles;

  return (
    <form action={formAction} className="space-y-4">
      {person ? <input type="hidden" name="id" value={person.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Papel" htmlFor="role_code" required className="sm:col-span-2">
          <div id="role_code" className="grid gap-2">
            {roleOptions.map((role) => {
              const selected = (person?.roleCode ?? roleOptions[0]?.code) === role.code;
              return (
                <label
                  key={role.code}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="role_code"
                    value={role.code}
                    defaultChecked={selected}
                    required
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{role.name}</span>
                    {role.description ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {role.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </Field>
        <Field label="Nome" htmlFor="first_name" required>
          <Input
            id="first_name"
            name="first_name"
            required
            defaultValue={person?.firstName}
            className="h-9"
            autoFocus
          />
        </Field>
        <Field label="Sobrenome" htmlFor="last_name" required>
          <Input
            id="last_name"
            name="last_name"
            required
            defaultValue={person?.lastName}
            className="h-9"
          />
        </Field>
        <Field label="E-mail" htmlFor="email" required className="sm:col-span-2">
          <Input
            id="email"
            name={person ? undefined : "email"}
            type="email"
            required={!person}
            readOnly={Boolean(person)}
            defaultValue={person?.email}
            className="h-9"
          />
        </Field>
        <Field label="Telefone" htmlFor="phone">
          <PhoneInput
            id="phone"
            name="phone"
            defaultValue={person?.phone}
            className="h-9"
          />
        </Field>
        {person ? null : (
          <Field
            label="Senha"
            htmlFor="password"
            required
            hint="Mínimo de 8 caracteres. Se o e-mail já tiver conta, a pessoa entra nesta empresa com a senha atual."
          >
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-9"
            />
          </Field>
        )}
      </div>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
