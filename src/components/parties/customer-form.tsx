"use client";

import { useActionState, useEffect } from "react";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { PhoneInput } from "@/components/forms/phone-input";
import { TaxIdInput } from "@/components/forms/tax-id-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer, updateCustomer } from "@/app/(app)/parties/actions";
import type { MutationState } from "@/lib/forms/state";
import type { CustomerRecord } from "@/lib/parties/queries";

export function CustomerForm({
  customer,
  onCancel,
  onSuccess,
}: {
  customer?: CustomerRecord;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = customer ? updateCustomer : createCustomer;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive" className="sm:col-span-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Nome" htmlFor="customer_name" required className="sm:col-span-2">
        <Input id="customer_name" name="name" required defaultValue={customer?.name} className="h-9" autoFocus />
      </Field>
      <Field label="CPF ou CNPJ" htmlFor="customer_tax_id" className="sm:col-span-2">
        <TaxIdInput
          id="customer_tax_id"
          name="tax_id"
          defaultValue={customer?.taxId}
          className="h-9 max-w-56"
        />
      </Field>
      <Field label="Telefone" htmlFor="customer_phone">
        <PhoneInput id="customer_phone" name="phone" defaultValue={customer?.phone} className="h-9" />
      </Field>
      <Field label="E-mail" htmlFor="customer_email">
        <Input id="customer_email" name="email" type="email" defaultValue={customer?.email ?? ""} className="h-9" />
      </Field>
      <Field label="Site" htmlFor="customer_website">
        <Input id="customer_website" name="website" defaultValue={customer?.website ?? ""} className="h-9" />
      </Field>
      <Field
        label="PIN"
        htmlFor="customer_pin"
        hint={
          customer
            ? "4 dígitos. Vale para o QR de todas as localizações deste cliente."
            : "Deixe em branco para gerar um PIN de 4 dígitos."
        }
      >
        <Input
          id="customer_pin"
          name="request_pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          pattern="[0-9]{4}"
          required={Boolean(customer)}
          defaultValue={customer?.requestPin ?? ""}
          className="h-9 max-w-32 tracking-widest"
          placeholder="0000"
        />
      </Field>
      <Field label="Tipo" htmlFor="customer_type">
        <Input id="customer_type" name="customer_type" defaultValue={customer?.customerType ?? ""} className="h-9" />
      </Field>
      <Field label="Descrição" htmlFor="customer_description" className="sm:col-span-2">
        <Textarea id="customer_description" name="description" defaultValue={customer?.description ?? ""} rows={3} />
      </Field>
      <div className="sm:col-span-2">
        <FormActions pending={pending} onCancel={onCancel} />
      </div>
    </form>
  );
}
