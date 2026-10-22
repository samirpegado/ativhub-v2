"use client";

import { useActionState, useEffect } from "react";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { PhoneInput } from "@/components/forms/phone-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createVendor, updateVendor } from "@/app/(app)/parties/actions";
import type { MutationState } from "@/lib/forms/state";
import type { VendorRecord } from "@/lib/parties/queries";

export function VendorForm({
  vendor,
  onCancel,
  onSuccess,
}: {
  vendor?: VendorRecord;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = vendor ? updateVendor : createVendor;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {vendor ? <input type="hidden" name="id" value={vendor.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive" className="sm:col-span-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Empresa" htmlFor="company_name" required className="sm:col-span-2">
        <Input id="company_name" name="company_name" required defaultValue={vendor?.companyName} className="h-9" autoFocus />
      </Field>
      <Field label="Contato" htmlFor="vendor_contact" required>
        <Input id="vendor_contact" name="name" required defaultValue={vendor?.name} className="h-9" />
      </Field>
      <Field label="Telefone" htmlFor="vendor_phone">
        <PhoneInput id="vendor_phone" name="phone" defaultValue={vendor?.phone} className="h-9" />
      </Field>
      <Field label="E-mail" htmlFor="vendor_email">
        <Input id="vendor_email" name="email" type="email" defaultValue={vendor?.email ?? ""} className="h-9" />
      </Field>
      <Field label="Site" htmlFor="vendor_website">
        <Input id="vendor_website" name="website" defaultValue={vendor?.website ?? ""} className="h-9" />
      </Field>
      <Field label="Tipo" htmlFor="vendor_type">
        <Input id="vendor_type" name="vendor_type" defaultValue={vendor?.vendorType ?? ""} className="h-9" />
      </Field>
      <Field label="Valor/hora" htmlFor="rate">
        <CurrencyInput id="rate" name="rate" defaultValue={vendor?.rate} className="h-9" />
      </Field>
      <Field label="Descrição" htmlFor="vendor_description" className="sm:col-span-2">
        <Textarea id="vendor_description" name="description" defaultValue={vendor?.description ?? ""} rows={3} />
      </Field>
      <div className="sm:col-span-2">
        <FormActions pending={pending} onCancel={onCancel} />
      </div>
    </form>
  );
}
