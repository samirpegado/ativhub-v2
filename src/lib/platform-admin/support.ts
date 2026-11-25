import { notFound } from "next/navigation";
import type { TechRange } from "@/lib/dashboard/overview";
import { parseUuid } from "@/lib/forms/parse";
import type { Json } from "@/lib/supabase/database.types";
import { requirePlatformOperator } from "./access";

type SupportPreview = {
  tenantId: string;
  tenantName: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  roleName: string | null;
  roleCode: string | null;
  permissions: Json;
  isOwner: boolean;
  subscriptionOpen: boolean;
  expiresAt: string;
  secondsRemaining: number;
  overview: Json;
};

export async function canStartSupportPreview() {
  const { supabase } = await requirePlatformOperator();
  const { data, error } = await supabase.rpc("platform_support_preview_status");
  return !error && data === true;
}

export async function loadSupportPreview(id: string, range: TechRange): Promise<SupportPreview | null> {
  const { supabase } = await requirePlatformOperator();
  let previewId: string | null;
  try {
    previewId = parseUuid(id);
  } catch {
    notFound();
  }
  if (!previewId) notFound();

  const { data, error } = await supabase.rpc("platform_read_support_preview", {
    p_preview_id: previewId,
    p_range: range,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Não foi possível consultar a visualização de suporte.");
  if (data === null) return null;
  if (typeof data !== "object" || Array.isArray(data) || typeof data.expiresAt !== "string") {
    throw new Error("A visualização de suporte retornou um resultado inválido.");
  }
  const secondsRemaining = Math.max(0, Math.ceil((Date.parse(data.expiresAt) - Date.now()) / 1_000));
  return { ...data, secondsRemaining } as SupportPreview;
}
