"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { createPart, updatePart } from "@/app/(app)/inventory/actions";
import { createClient } from "@/lib/supabase/client";
import type { MutationState } from "@/lib/forms/state";
import type { PartRecord } from "@/lib/inventory/queries";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "jpg" || fromName === "jpeg" || fromName === "png" || fromName === "webp") {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return null;
}

export function PartForm({
  part,
  tenantId,
  onCancel,
  onSuccess,
}: {
  part?: PartRecord;
  tenantId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = part ? updatePart : createPart;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [preview, setPreview] = useState<string | null>(part?.imageUrl ?? null);
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
      const path = `${tenantId}/parts/${part?.id ?? crypto.randomUUID()}.${extension}`;
      setUploading(true);
      const { error } = await createClient().storage.from("attachments").upload(path, file, {
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
      <Field label="Custo" htmlFor="cost">
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
      <Field label="Quantidade mínima" htmlFor="min_quantity">
        <Input
          id="min_quantity"
          name="min_quantity"
          inputMode="decimal"
          defaultValue={part?.minQuantity ?? 0}
          className="h-9"
        />
      </Field>
      <Field label="Unidade" htmlFor="unit">
        <Input id="unit" name="unit" defaultValue={part?.unit ?? ""} placeholder="un, kg, L" className="h-9" />
      </Field>
      <Field label="Código de barras" htmlFor="bar_code">
        <Input id="bar_code" name="bar_code" defaultValue={part?.barcode ?? ""} className="h-9" />
      </Field>
      <Field label="Área" htmlFor="area" className="sm:col-span-2">
        <Input id="area" name="area" defaultValue={part?.area ?? ""} className="h-9" />
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
      <Field label="Imagem" htmlFor="part_image" className="sm:col-span-2">
        {preview ? (
          // URL local ou assinada do Storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="mb-2 size-16 rounded-md object-cover" />
        ) : null}
        <Input
          id="part_image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="h-9"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
        {part?.imageUrl ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => {
              setFile(null);
              setPreview(null);
              setRemoved(true);
            }}
          >
            Remover imagem
          </button>
        ) : null}
        {imageError ? <p className="text-xs text-destructive">{imageError}</p> : null}
      </Field>
      <div className="sm:col-span-2">
        <FormActions pending={busy} onCancel={onCancel} />
      </div>
    </form>
  );
}
