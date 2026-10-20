"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { BRAZIL_STATES } from "@/lib/address/states";
import { digitsOnly, formatCep } from "@/lib/address/format";
import { lookupCep } from "@/lib/address/viacep";
import type { MutationState } from "@/lib/forms/state";
import {
  createLocation,
  updateLocation,
} from "@/app/(app)/locations/actions";

type LocationValues = {
  id?: string;
  name: string;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export function LocationForm({
  location,
  onCancel,
  onSuccess,
}: {
  location?: LocationValues;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = location ? updateLocation : createLocation;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  const [postalCode, setPostalCode] = useState(
    formatCep(location?.postal_code ?? ""),
  );
  const [street, setStreet] = useState(location?.street ?? "");
  const [number, setNumber] = useState(location?.number ?? "");
  const [complement, setComplement] = useState(location?.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(
    location?.neighborhood ?? "",
  );
  const [city, setCity] = useState(location?.city ?? "");
  const [stateUf, setStateUf] = useState(location?.state ?? "");
  const [cepStatus, setCepStatus] = useState<
    "idle" | "loading" | "ok" | "not_found" | "error"
  >("idle");
  const lastLookedUp = useRef(digitsOnly(location?.postal_code ?? ""));
  const cepRequest = useRef(0);

  async function handleCepChange(value: string) {
    const formatted = formatCep(value);
    setPostalCode(formatted);
    const digits = digitsOnly(formatted);
    cepRequest.current += 1;
    const requestId = cepRequest.current;

    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }
    if (digits === lastLookedUp.current) {
      setCepStatus("idle");
      return;
    }

    setCepStatus("loading");
    try {
      const result = await lookupCep(digits);
      if (requestId !== cepRequest.current) return;
      lastLookedUp.current = digits;
      if (!result) {
        setCepStatus("not_found");
        return;
      }
      setStreet(result.street);
      setNeighborhood(result.neighborhood);
      setCity(result.city);
      setStateUf(result.state);
      setCepStatus("ok");
    } catch {
      if (requestId === cepRequest.current) setCepStatus("error");
    }
  }

  const cepHint =
    cepStatus === "loading"
      ? "Buscando endereço..."
      : cepStatus === "not_found"
        ? "CEP não encontrado."
        : cepStatus === "error"
          ? "Não foi possível consultar o CEP."
          : cepStatus === "ok"
            ? "Endereço preenchido pelo CEP."
            : "Ao informar o CEP, o endereço é preenchido automaticamente.";

  return (
    <form action={formAction} className="space-y-5">
      {location?.id ? <input type="hidden" name="id" value={location.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field label="Nome" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          required
          defaultValue={location?.name}
          className="h-9"
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="CEP" htmlFor="postal_code" hint={cepHint}>
          <Input
            id="postal_code"
            name="postal_code"
            inputMode="numeric"
            autoComplete="postal-code"
            value={postalCode}
            onChange={(event) => void handleCepChange(event.target.value)}
            className="h-9"
            placeholder="00000-000"
          />
        </Field>
        <Field label="Rua" htmlFor="street" className="sm:col-span-2">
          <Input
            id="street"
            name="street"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Número" htmlFor="address_number">
          <Input
            id="address_number"
            name="address_number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="h-9"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Complemento" htmlFor="complement">
          <Input
            id="complement"
            name="complement"
            value={complement}
            onChange={(event) => setComplement(event.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Bairro" htmlFor="neighborhood">
          <Input
            id="neighborhood"
            name="neighborhood"
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Cidade" htmlFor="city">
          <Input
            id="city"
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Estado" htmlFor="state">
          <NativeSelect
            id="state"
            name="state"
            className="h-9"
            value={stateUf}
            onChange={(event) => setStateUf(event.target.value)}
          >
            <option value="">Selecione</option>
            {BRAZIL_STATES.map((item) => (
              <option key={item.uf} value={item.uf}>
                {item.uf} — {item.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
