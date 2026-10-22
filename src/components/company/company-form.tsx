"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateCompany } from "@/app/(app)/company/actions";
import { Field } from "@/components/forms/field";
import { PhoneInput } from "@/components/forms/phone-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { digitsOnly, formatCep } from "@/lib/address/format";
import { BRAZIL_STATES } from "@/lib/address/states";
import { lookupCep } from "@/lib/address/viacep";
import type { CompanyProfile } from "@/lib/company/profile";
import type { MutationState } from "@/lib/forms/state";
import { compressAvatar } from "@/lib/images/compress-avatar";
import { createClient } from "@/lib/supabase/client";

export function CompanyForm({
  tenantId,
  company,
}: {
  tenantId: string;
  company: CompanyProfile;
}) {
  const [state, formAction, pending] = useActionState<MutationState, FormData>(updateCompany, undefined);
  const [saving, startSaving] = useTransition();
  const [postalCode, setPostalCode] = useState(company.address.postalCode);
  const [street, setStreet] = useState(company.address.street);
  const [number, setNumber] = useState(company.address.number);
  const [complement, setComplement] = useState(company.address.complement);
  const [neighborhood, setNeighborhood] = useState(company.address.neighborhood);
  const [city, setCity] = useState(company.address.city);
  const [stateUf, setStateUf] = useState(company.address.state);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "not_found" | "error">("idle");
  const [preview, setPreview] = useState(company.logoUrl);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const lastLookedUp = useRef(digitsOnly(company.address.postalCode));

  async function handleCepChange(value: string) {
    const formatted = formatCep(value);
    setPostalCode(formatted);
    const digits = digitsOnly(formatted);
    if (digits.length !== 8 || digits === lastLookedUp.current) {
      if (digits.length !== 8) setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    const found = await lookupCep(digits);
    lastLookedUp.current = digits;
    if (!found) {
      setCepStatus("not_found");
      return;
    }
    setStreet(found.street);
    setComplement(found.complement);
    setNeighborhood(found.neighborhood);
    setCity(found.city);
    setStateUf(found.state);
    setCepStatus("ok");
  }

  async function onFile(next: File | null) {
    setImageError(null);
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setImageError("Envie uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (next.size > 12 * 1024 * 1024) {
      setImageError("A imagem original deve ter no máximo 12 MB.");
      return;
    }
    try {
      const compressed = await compressAvatar(next);
      setFile(compressed);
      setRemoved(false);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setImageError("Não foi possível processar a imagem.");
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startSaving(async () => {
      if (file) {
        const path = `${tenantId}/logo.jpg`;
        const { error } = await createClient().storage.from("attachments").upload(path, file, {
          upsert: true,
          contentType: "image/jpeg",
          cacheControl: "3600",
        });
        if (error) {
          setImageError("Não foi possível enviar o logo.");
          return;
        }
        formData.set("image_path", path);
      } else if (removed) {
        formData.set("image_path", "");
      }
      formAction(formData);
    });
  }

  const busy = pending || saving;
  const cepHint =
    cepStatus === "loading"
      ? "Buscando endereço..."
      : cepStatus === "not_found"
        ? "CEP não encontrado."
        : cepStatus === "ok"
          ? "Endereço preenchido pelo CEP."
          : "Ao informar o CEP, o endereço é preenchido automaticamente.";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.success ? (
        <Alert>
          <AlertDescription>Empresa salva.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="gap-4 p-4">
        <h2 className="font-semibold">Dados</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
            <Input id="name" name="name" required defaultValue={company.name} className="h-9" />
          </Field>
          <Field label="Telefone" htmlFor="phone">
            <PhoneInput id="phone" name="phone" defaultValue={company.phone} className="h-9" />
          </Field>
          <Field label="Site" htmlFor="website">
            <Input id="website" name="website" defaultValue={company.website} className="h-9" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="CEP" htmlFor="postal_code" hint={cepHint}>
            <Input id="postal_code" name="postal_code" value={postalCode} onChange={(event) => void handleCepChange(event.target.value)} className="h-9" placeholder="00000-000" />
          </Field>
          <Field label="Rua" htmlFor="street" className="sm:col-span-2">
            <Input id="street" name="street" value={street} onChange={(event) => setStreet(event.target.value)} className="h-9" />
          </Field>
          <Field label="Número" htmlFor="address_number">
            <Input id="address_number" name="address_number" value={number} onChange={(event) => setNumber(event.target.value)} className="h-9" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Complemento" htmlFor="complement">
            <Input id="complement" name="complement" value={complement} onChange={(event) => setComplement(event.target.value)} className="h-9" />
          </Field>
          <Field label="Bairro" htmlFor="neighborhood">
            <Input id="neighborhood" name="neighborhood" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className="h-9" />
          </Field>
          <Field label="Cidade" htmlFor="city">
            <Input id="city" name="city" value={city} onChange={(event) => setCity(event.target.value)} className="h-9" />
          </Field>
          <Field label="Estado" htmlFor="state">
            <NativeSelect id="state" name="state" className="h-9" value={stateUf} onChange={(event) => setStateUf(event.target.value)}>
              <option value="">Selecione</option>
              {BRAZIL_STATES.map((item) => (
                <option key={item.uf} value={item.uf}>{item.uf} — {item.name}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Card>

      <Card className="gap-4 p-4">
        <h2 className="font-semibold">Logo</h2>
        <p className="text-sm text-muted-foreground">Aparece nesta tela e no relatório impresso da ordem. A marca do AtivHub no menu não muda.</p>
        <div className="flex flex-wrap items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo da empresa" className="size-20 rounded-lg border object-contain" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-lg border text-xs text-muted-foreground">Sem logo</div>
          )}
          <div className="space-y-2">
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} />
            {preview ? (
              <Button type="button" variant="outline" className="h-9" onClick={() => { setFile(null); setPreview(null); setRemoved(true); }}>
                Remover logo
              </Button>
            ) : null}
          </div>
        </div>
        {imageError ? <p className="text-sm text-destructive">{imageError}</p> : null}
      </Card>

      <Card className="gap-4 p-4">
        <h2 className="font-semibold">PIN da solicitação</h2>
        <p className="text-sm text-muted-foreground">
          {company.hasRequestPin
            ? "Já existe um PIN. Deixe em branco para mantê-lo, ou digite outro de 4 a 6 dígitos."
            : "Defina um PIN de 4 a 6 dígitos. Ele não entra no QR e não é mostrado de novo."}
        </p>
        <Field label="Novo PIN" htmlFor="request_pin">
          <Input id="request_pin" name="request_pin" inputMode="numeric" autoComplete="off" maxLength={6} className="h-9 max-w-40" placeholder="0000" />
        </Field>
      </Card>

      <Button type="submit" className="h-9 font-semibold" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        Salvar
      </Button>
    </form>
  );
}
