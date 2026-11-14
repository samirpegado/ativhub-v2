"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { createPart, updatePart } from "@/app/(app)/inventory/actions";
import type { MutationState } from "@/lib/forms/state";
import type { PartRecord } from "@/lib/inventory/queries";

const PART_UNITS = [
  { value: "un", label: "Unidade (un)" },
  { value: "pç", label: "Peça (pç)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "L", label: "Litro (L)" },
  { value: "mL", label: "Mililitro (mL)" },
  { value: "m", label: "Metro (m)" },
  { value: "cm", label: "Centímetro (cm)" },
  { value: "m²", label: "Metro quadrado (m²)" },
  { value: "cx", label: "Caixa (cx)" },
  { value: "pct", label: "Pacote (pct)" },
  { value: "par", label: "Par" },
  { value: "rolo", label: "Rolo" },
] as const;

const OTHER_UNIT = "OTHER";

function unitChoice(unit: string | null | undefined) {
  if (!unit) return "";
  return PART_UNITS.some((item) => item.value === unit) ? unit : OTHER_UNIT;
}

export function PartForm({
  part,
  onCancel,
  onSuccess,
}: {
  part?: PartRecord;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = part ? updatePart : createPart;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);
  const [isPending, startTransition] = useTransition();
  const [unit, setUnit] = useState(() => unitChoice(part?.unit));
  const [customUnit, setCustomUnit] = useState(unitChoice(part?.unit) === OTHER_UNIT ? part?.unit ?? "" : "");

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  }

  const busy = pending || isPending;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {part ? <input type="hidden" name="id" value={part.id} /> : null}
      {state?.error ? (
        <div className="sm:col-span-2">
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
        <Input id="name" name="name" required defaultValue={part?.name ?? ""} className="h-9" />
      </Field>
      <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={part?.description ?? ""} rows={3} />
      </Field>
      <Field label="Valor" htmlFor="cost">
        <CurrencyInput id="cost" name="cost" defaultValue={part?.cost ?? 0} className="h-9" />
      </Field>
      <Field label="Quantidade" htmlFor="quantity">
        <Input
          id="quantity"
          name="quantity"
          inputMode="decimal"
          defaultValue={part?.quantity ?? 0}
          className="h-9"
        />
      </Field>
      <Field label="Unidade" htmlFor="unit">
        <NativeSelect
          id="unit"
          className="h-9"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
        >
          <option value="">Selecione</option>
          {PART_UNITS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
          <option value={OTHER_UNIT}>Outro</option>
        </NativeSelect>
        {unit === OTHER_UNIT ? (
          <Input
            name="unit"
            required
            value={customUnit}
            maxLength={30}
            placeholder="Digite a unidade"
            className="mt-2 h-9"
            onChange={(event) => setCustomUnit(event.target.value)}
          />
        ) : (
          <input type="hidden" name="unit" value={unit} />
        )}
      </Field>
      <Field label="Código de barras" htmlFor="bar_code">
        <Input id="bar_code" name="bar_code" defaultValue={part?.barcode ?? ""} className="h-9" />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="non_stock"
          defaultChecked={part?.nonStock ?? false}
          className="size-4 rounded border"
        />
        Sem controle de estoque
      </label>
      <div className="sm:col-span-2">
        <FormActions pending={busy} onCancel={onCancel} />
      </div>
    </form>
  );
}
