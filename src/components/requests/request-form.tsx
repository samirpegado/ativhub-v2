"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { createRequest, updateRequest } from "@/app/(app)/requests/actions";
import { LockedAsset } from "@/components/assets/locked-asset";
import { PreventiveAssetPicker } from "@/components/preventive/preventive-asset-picker";
import { Field } from "@/components/forms/field";
import { PhotoSourcePicker } from "@/components/images/photo-source-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compressWorkOrderPhoto } from "@/lib/images/compress-work-order-photo";
import type { MutationState } from "@/lib/forms/state";
import type { AssetPickerHit } from "@/lib/assets/picker";
import { createClient } from "@/lib/supabase/client";

export type RequestFormValues = {
  id: string;
  title: string;
  description: string | null;
  assetId: string | null;
  imagePath: string | null;
  imageUrl: string | null;
};

export function RequestForm({
  request,
  assetId: initialAssetId = null,
  lockedAsset = null,
  tenantId,
  onCancel,
  onSuccess,
}: {
  request?: RequestFormValues | null;
  assetId?: string | null;
  lockedAsset?: AssetPickerHit | null;
  tenantId: string;
  onCancel: () => void;
  onSuccess: (id?: string) => void;
}) {
  const action = request ? updateRequest : createRequest;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);
  const [assetId, setAssetId] = useState(request?.assetId ?? lockedAsset?.id ?? initialAssetId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(request?.imageUrl ?? null);
  const [removed, setRemoved] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (state?.success) onSuccessRef.current(state.id);
  }, [state]);

  function onFile(next: File | null) {
    setImageError(null);
    if (!next) return;
    setFile(next);
    setRemoved(false);
    setPreview(URL.createObjectURL(next));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImageError(null);
    const formData = new FormData(event.currentTarget);
    if (removed) {
      formData.set("image_path", "");
    } else if (file) {
      setUploading(true);
      try {
        const photo = await compressWorkOrderPhoto(file);
        const path = `${tenantId}/requests/${crypto.randomUUID()}.jpg`;
        const supabase = createClient();
        const { error } = await supabase.storage.from("attachments").upload(path, photo, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (error) {
          setImageError("Não foi possível enviar a foto.");
          return;
        }
        formData.set("image_path", path);
      } catch (error) {
        setImageError(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
        return;
      } finally {
        setUploading(false);
      }
    } else if (request?.imagePath) {
      formData.set("image_path", request.imagePath);
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  const busy = pending || isPending || uploading;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {request ? <input type="hidden" name="id" value={request.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Ativo" required>
        {lockedAsset ? (
          <LockedAsset asset={lockedAsset} />
        ) : (
          <PreventiveAssetPicker
            selection="single"
            required
            selectedId={assetId || null}
            onSelected={(asset) => setAssetId(asset?.id ?? "")}
          />
        )}
      </Field>
      <Field label="Foto" hint="Uma imagem PNG, JPG ou WebP, de até 2 MB.">
          <PhotoSourcePicker disabled={uploading} onFile={onFile}>
            {({ phone, openGallery, openCamera }) => (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex size-20 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40 text-muted-foreground"
                  onClick={openGallery}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="size-full object-cover" />
                  ) : uploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Camera className="size-5" />
                  )}
                </button>
                <div className="space-y-1">
                  {phone ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="h-9" disabled={uploading} onClick={openGallery}>
                        <ImageIcon /> Galeria
                      </Button>
                      <Button type="button" variant="outline" className="h-9" disabled={uploading} onClick={openCamera}>
                        <Camera /> Câmera
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="h-9" disabled={uploading} onClick={openGallery}>
                      {preview ? "Trocar foto" : "Anexar foto"}
                    </Button>
                  )}
                  {preview ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm text-muted-foreground"
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                        setRemoved(true);
                      }}
                    >
                      <X className="size-3.5" />
                      Remover
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </PhotoSourcePicker>
          {imageError ? <p className="text-xs text-destructive">{imageError}</p> : null}
        </Field>
      <Field label="Título" htmlFor="request-title">
        <Input id="request-title" name="title" className="h-9" placeholder="Opcional" defaultValue={request?.title ?? ""} />
      </Field>
      <Field label="Descrição" htmlFor="request-description" required>
        <Textarea id="request-description" name="description" required rows={4} defaultValue={request?.description ?? ""} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="h-9" disabled={busy}>{busy ? "Salvando..." : request ? "Salvar" : "Criar"}</Button>
      </div>
    </form>
  );
}
