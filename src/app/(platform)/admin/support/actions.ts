"use server";

import { redirect } from "next/navigation";
import { parseUuid } from "@/lib/forms/parse";
import { requirePlatformOperator } from "@/lib/platform-admin/access";
import { PLATFORM_SUPPORT_PATH, PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";

export type SupportPreviewFormState = { error: string } | undefined;

export async function startSupportPreview(
  _previous: SupportPreviewFormState,
  formData: FormData,
): Promise<SupportPreviewFormState> {
  const { supabase } = await requirePlatformOperator();
  let tenantId: string | null;
  let membershipId: string | null;
  try {
    tenantId = parseUuid(formData.get("tenantId"));
    membershipId = parseUuid(formData.get("membershipId"));
  } catch {
    return { error: "Selecione uma pessoa válida para visualizar o painel." };
  }
  if (!tenantId || !membershipId) return { error: "Selecione uma pessoa para visualizar o painel." };

  const { data, error } = await supabase.rpc("platform_start_support_preview", {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
  });
  if (error?.code === "42501") return { error: "Seu acesso de suporte está indisponível." };
  if (error) return { error: "Não foi possível abrir a visualização. Tente novamente." };
  if (!data) return { error: "Esta pessoa está indisponível para visualização." };

  redirect(`${PLATFORM_SUPPORT_PATH}/${data}`);
}

export async function endSupportPreview(previewId: string) {
  const { supabase } = await requirePlatformOperator();
  const { data, error } = await supabase.rpc("platform_end_support_preview", { p_preview_id: previewId });
  if (error && error.code !== "42501") throw new Error("Não foi possível encerrar a visualização de suporte.");
  redirect(data ? `${PLATFORM_TENANTS_PATH}/${data}` : PLATFORM_TENANTS_PATH);
}
