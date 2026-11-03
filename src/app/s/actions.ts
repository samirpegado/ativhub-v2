"use server";

import { createClient } from "@/lib/supabase/server";
import { formatPhone, phoneDigits } from "@/lib/phone/br";
import {
  parsePublicOverview,
  parsePublicReport,
  parsePublicUnlock,
  type PublicAsset,
  type PublicOverview,
  type PublicReport,
} from "@/lib/requests/public";

export type { PublicAsset, PublicOverview, PublicReport };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function publicError(message: string | undefined, fallback: string) {
  const text = message ?? "";
  const known = [
    "PIN",
    "Sessão",
    "tentativas",
    "localização",
    "Equipamento",
    "Ativo",
    "Ordem",
    "Informe",
    "Descreva",
    "solicita",
  ];
  if (known.some((item) => text.includes(item))) return text;
  return fallback;
}

export async function lookupPublicAsset(input: {
  assetId?: string;
  barcode?: string;
}): Promise<{ error: string } | { asset: PublicAsset }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_public_asset", {
    p_asset_id: input.assetId,
    p_barcode: input.barcode?.trim() || undefined,
  });
  if (error) return { error: "Não foi possível localizar o equipamento." };
  const row = asRecord(data);
  if (row?.ambiguous === true) {
    return { error: "Este código aparece em mais de um equipamento. Use o QR." };
  }
  if (row?.found !== true || typeof row.id !== "string" || typeof row.name !== "string") {
    return { error: "Equipamento não encontrado." };
  }
  return {
    asset: {
      id: row.id,
      name: row.name,
      customId: typeof row.customId === "string" ? row.customId : null,
      barCode: typeof row.barCode === "string" ? row.barCode : null,
      locationName: typeof row.locationName === "string" ? row.locationName : null,
    },
  };
}

export async function unlockPublicAsset(
  assetId: string,
  pin: string,
): Promise<{ error: string } | (PublicOverview & { token: string })> {
  if (!UUID_RE.test(assetId)) return { error: "Equipamento não encontrado." };
  if (!/^\d{4}$/.test(pin)) return { error: "Informe o PIN de 4 dígitos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_asset_unlock", {
    p_asset_id: assetId,
    p_pin: pin,
  });
  if (error) return { error: publicError(error.message, "Não foi possível validar o PIN.") };
  const parsed = parsePublicUnlock(data);
  if (!parsed) return { error: "Não foi possível abrir o equipamento." };
  return parsed;
}

export async function loadPublicOverview(
  token: string,
): Promise<{ error: string } | PublicOverview> {
  if (!UUID_RE.test(token)) return { error: "Sessão expirada. Informe o PIN novamente." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_asset_overview", { p_token: token });
  if (error) return { error: publicError(error.message, "Sessão expirada. Informe o PIN novamente.") };
  const parsed = parsePublicOverview(data);
  if (!parsed) return { error: "Não foi possível carregar o histórico." };
  return parsed;
}

export async function loadPublicReport(
  token: string,
  workOrderId: string,
): Promise<{ error: string } | { report: PublicReport }> {
  if (!UUID_RE.test(token) || !UUID_RE.test(workOrderId)) {
    return { error: "Não foi possível abrir o relatório." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_work_order_report", {
    p_token: token,
    p_work_order_id: workOrderId,
  });
  if (error) return { error: publicError(error.message, "Não foi possível abrir o relatório.") };
  const report = parsePublicReport(data);
  if (!report) return { error: "Não foi possível abrir o relatório." };
  return { report };
}

export async function submitPublicRequest(
  _prev: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const token = String(formData.get("token") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!UUID_RE.test(token)) return { error: "Sessão expirada. Informe o PIN novamente." };
  if (!name) return { error: "Informe o nome." };
  if (phoneDigits(phoneRaw).length < 10) return { error: "Informe o telefone." };
  if (!description) return { error: "Descreva o que aconteceu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_public_request", {
    p_token: token,
    p_name: name,
    p_phone: formatPhone(phoneRaw),
    p_description: description,
  });
  if (error) return { error: publicError(error.message, "Não foi possível enviar a solicitação.") };
  return { success: true };
}
