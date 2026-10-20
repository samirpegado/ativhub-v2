"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Lock, Pencil, Upload, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  changePassword,
  setProfilePhoto,
  updateProfile,
} from "@/app/(app)/profile/actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { PhoneInput } from "@/components/forms/phone-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { MutationState } from "@/lib/forms/state";
import { formatPhone } from "@/lib/phone/br";
import type { ProfileData } from "@/lib/profile/queries";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/jpeg") return "jpg";
  return null;
}

export function ProfileView({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const photo = preview ?? profile.imageUrl;

  async function onPhoto(file: File) {
    setPhotoError(null);
    const extension = extensionFor(file);
    if (!extension) {
      setPhotoError("Envie uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("A imagem deve ter no máximo 2 MB.");
      return;
    }

    const path = `${profile.tenantId}/avatars/${profile.membershipId}.${extension}`;
    setUploading(true);
    const supabase = createClient();
    const { error } = await supabase.storage.from("attachments").upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (error) {
      setUploading(false);
      setPhotoError("Não foi possível enviar a foto.");
      return;
    }

    const result = await setProfilePhoto(path);
    setUploading(false);
    if (result?.error) {
      setPhotoError(result.error);
      return;
    }
    setPreview(URL.createObjectURL(file));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="items-center px-6 py-8 text-center shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]">
          <div className="relative">
            <div className="flex size-28 items-center justify-center overflow-hidden rounded-2xl bg-muted text-muted-foreground">
              {photo ? (
                // URL assinada do Storage ou prévia local.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={displayName} className="size-full object-cover" />
              ) : (
                <UserRound className="size-14" />
              )}
            </div>
            <button
              type="button"
              className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md disabled:opacity-60"
              aria-label="Enviar foto de perfil"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onPhoto(file);
              }}
            />
          </div>
          <p className="mt-4 font-semibold">{displayName || profile.email}</p>
          {photoError ? (
            <p className="mt-2 text-xs text-destructive">{photoError}</p>
          ) : null}
        </Card>

        <Card className="overflow-hidden py-0 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]">
          <div className="px-5 py-4 font-semibold">Atividade recente</div>
          <Separator />
          <div className="flex items-start gap-4 px-5 py-6">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="size-6" />
            </div>
            <div>
              <p className="text-lg font-bold">Ordens de serviço</p>
              <div className="mt-4 flex gap-12">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Criado
                  </p>
                  <p className="text-3xl font-bold">{profile.createdWorkOrders}</p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Concluído
                  </p>
                  <p className="text-3xl font-bold">{profile.completedWorkOrders}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden py-0 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-semibold">Detalhes pessoais</p>
            <p className="text-sm text-muted-foreground">
              Gerencie informações relacionadas aos seus detalhes pessoais
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => setEditing(true)}
            >
              <Pencil />
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => setChangingPassword(true)}
            >
              <Lock />
              Alterar senha
            </Button>
          </div>
        </div>
        <Separator />
        <dl className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 gap-y-4 px-5 py-8 text-sm">
          <Detail label="Nome" value={profile.firstName} />
          <Detail label="Sobrenome" value={profile.lastName} />
          <Detail label="Endereço de e-mail" value={profile.email || "N/A"} />
          <Detail label="Telefone" value={formatPhone(profile.phone) || "N/A"} />
          <Detail label="Cargo" value={profile.jobTitle || "N/A"} />
        </dl>
      </Card>

      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Editar perfil"
        description="Atualize seus dados pessoais."
      >
        {editing ? (
          <ProfileForm
            profile={profile}
            onCancel={() => setEditing(false)}
            onSuccess={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        ) : null}
      </FormDialog>

      <FormDialog
        open={changingPassword}
        onOpenChange={setChangingPassword}
        title="Alterar senha"
        description="Use no mínimo 8 caracteres."
      >
        {changingPassword ? (
          <PasswordForm
            onCancel={() => setChangingPassword(false)}
            onSuccess={() => setChangingPassword(false)}
          />
        ) : null}
      </FormDialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-semibold break-all">{value}</dd>
    </>
  );
}

function ProfileForm({
  profile,
  onCancel,
  onSuccess,
}: {
  profile: ProfileData;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<MutationState, FormData>(
    updateProfile,
    undefined,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="first_name" required>
          <Input
            id="first_name"
            name="first_name"
            required
            defaultValue={profile.firstName}
            className="h-9"
            autoFocus
          />
        </Field>
        <Field label="Sobrenome" htmlFor="last_name" required>
          <Input
            id="last_name"
            name="last_name"
            required
            defaultValue={profile.lastName}
            className="h-9"
          />
        </Field>
        <Field label="E-mail" htmlFor="email" className="sm:col-span-2">
          <Input id="email" value={profile.email} readOnly className="h-9" />
        </Field>
        <Field label="Telefone" htmlFor="phone">
          <PhoneInput
            id="phone"
            name="phone"
            defaultValue={profile.phone}
            className="h-9"
          />
        </Field>
        <Field
          label="Cargo"
          htmlFor="job_title"
          hint={
            profile.isAdmin
              ? undefined
              : "Só um administrador pode alterar o cargo."
          }
        >
          <Input
            id="job_title"
            name={profile.isAdmin ? "job_title" : undefined}
            defaultValue={profile.jobTitle ?? ""}
            disabled={!profile.isAdmin}
            className="h-9"
          />
        </Field>
      </div>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}

function PasswordForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState<MutationState, FormData>(
    changePassword,
    undefined,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Senha atual" htmlFor="current_password" required>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          className="h-9"
          autoFocus
        />
      </Field>
      <Field label="Nova senha" htmlFor="new_password" required>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-9"
        />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirm_password" required>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-9"
        />
      </Field>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
