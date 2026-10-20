"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { ASSET_STATUSES } from "@/lib/assets/status";
import type { LocationOption } from "@/lib/locations/queries";
import type { MutationState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/client";
import { createAsset, updateAsset } from "@/app/(app)/assets/actions";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/jpeg") return "jpg";
  return null;
}

type AssetValues = {
  id?: string;
  name: string;
  description: string | null;
  location_id: string | null;
  status: string;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  bar_code: string | null;
  power: string | null;
  area: string | null;
  acquisition_cost: number | null;
  in_service_date: string | null;
  warranty_expiration_date: string | null;
  additional_infos: string | null;
  imageUrl?: string | null;
};

export function AssetForm({
  asset,
  locations,
  tenantId,
  onCancel,
  onSuccess,
}: {
  asset?: AssetValues;
  locations: LocationOption[];
  tenantId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = asset ? updateAsset : createAsset;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(asset?.imageUrl ?? null);
  const [removed, setRemoved] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  function onFile(next: File | null) {
    setImageError(null);
    if (!next) return;
    const extension = extensionFor(next);
    if (!extension) {
      setImageError("Envie uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setImageError("A imagem deve ter no máximo 2 MB.");
      return;
    }
    setFile(next);
    setRemoved(false);
    setPreview(URL.createObjectURL(next));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImageError(null);
    const formData = new FormData(event.currentTarget);

    if (file) {
      const extension = extensionFor(file);
      if (!extension) return;
      const path = `${tenantId}/assets/${asset?.id ?? crypto.randomUUID()}.${extension}`;
      setUploading(true);
      const supabase = createClient();
      const { error } = await supabase.storage.from("attachments").upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
      setUploading(false);
      if (error) {
        setImageError("Não foi possível enviar a imagem.");
        return;
      }
      formData.set("image_path", path);
    } else if (removed) {
      formData.set("image_path", "");
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  const busy = pending || isPending || uploading;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {asset?.id ? <input type="hidden" name="id" value={asset.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field
        label="Imagem"
        htmlFor="asset_image"
        className="flex flex-col items-center text-center"
      >
        <div className="relative mx-auto w-full max-w-sm">
          <button
            id="asset_image"
            type="button"
            className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 text-muted-foreground hover:bg-muted"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              // Prévia local ou URL assinada do Storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-4 text-center text-sm">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ImagePlus className="size-5" />
                )}
                Clique para enviar a imagem do ativo
              </span>
            )}
          </button>
          {preview ? (
            <button
              type="button"
              className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
              aria-label="Remover imagem"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setRemoved(true);
              }}
            >
              <X className="size-4" />
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              event.target.value = "";
              onFile(next);
            }}
          />
        </div>
        {imageError ? <p className="text-xs text-destructive">{imageError}</p> : null}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="name" required>
          <Input
            id="name"
            name="name"
            required
            defaultValue={asset?.name}
            className="h-9"
            autoFocus
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <NativeSelect
            id="status"
            name="status"
            className="h-9"
            defaultValue={asset?.status ?? "OPERATIONAL"}
          >
            {ASSET_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Localização" htmlFor="location_id" required>
          <NativeSelect
            id="location_id"
            name="location_id"
            required
            className="h-9"
            defaultValue={asset?.location_id ?? ""}
          >
            <option value="">Selecione</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.custom_id ? `${location.custom_id} · ` : ""}
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Modelo" htmlFor="model">
          <Input id="model" name="model" defaultValue={asset?.model ?? ""} className="h-9" />
        </Field>
        <Field label="Fabricante" htmlFor="manufacturer">
          <Input
            id="manufacturer"
            name="manufacturer"
            defaultValue={asset?.manufacturer ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Número de série" htmlFor="serial_number">
          <Input
            id="serial_number"
            name="serial_number"
            defaultValue={asset?.serial_number ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Código de barras" htmlFor="bar_code">
          <Input
            id="bar_code"
            name="bar_code"
            defaultValue={asset?.bar_code ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Potência" htmlFor="power">
          <Input id="power" name="power" defaultValue={asset?.power ?? ""} className="h-9" />
        </Field>
        <Field label="Área" htmlFor="area">
          <Input id="area" name="area" defaultValue={asset?.area ?? ""} className="h-9" />
        </Field>
        <Field label="Custo de aquisição" htmlFor="acquisition_cost">
          <CurrencyInput
            id="acquisition_cost"
            name="acquisition_cost"
            defaultValue={asset?.acquisition_cost}
            className="h-9"
          />
        </Field>
        <Field label="Em serviço desde" htmlFor="in_service_date">
          <Input
            id="in_service_date"
            name="in_service_date"
            type="date"
            defaultValue={asset?.in_service_date ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Fim da garantia" htmlFor="warranty_expiration_date">
          <Input
            id="warranty_expiration_date"
            name="warranty_expiration_date"
            type="date"
            defaultValue={asset?.warranty_expiration_date ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea
            id="description"
            name="description"
            defaultValue={asset?.description ?? ""}
            rows={3}
          />
        </Field>
        <Field
          label="Informações adicionais"
          htmlFor="additional_infos"
          className="sm:col-span-2"
        >
          <Textarea
            id="additional_infos"
            name="additional_infos"
            defaultValue={asset?.additional_infos ?? ""}
            rows={3}
          />
        </Field>
      </div>

      <FormActions pending={busy} onCancel={onCancel} />
    </form>
  );
}
