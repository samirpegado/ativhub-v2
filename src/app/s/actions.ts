"use server";

import { createClient } from "@/lib/supabase/server";
import { formatPhone, phoneDigits } from "@/lib/phone/br";

export type PublicAsset = {
  id: string;
  name: string;
  customId: string | null;
  barCode: string | null;
  locationName: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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

export async function submitPublicRequest(
  _prev: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const assetId = String(formData.get("asset_id") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!name) return { error: "Informe o nome." };
  if (phoneDigits(phoneRaw).length < 10) return { error: "Informe o telefone." };
  if (!description) return { error: "Descreva o que aconteceu." };
  if (!/^\d{4,6}$/.test(pin)) return { error: "Informe o PIN de 4 a 6 dígitos." };

  let targetId = assetId;
  if (barcode) {
    const found = await lookupPublicAsset({ barcode });
    if ("error" in found) return { error: found.error };
    targetId = found.asset.id;
  }
  if (!targetId) return { error: "Informe o equipamento." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_public_request", {
    p_asset_id: targetId,
    p_pin: pin,
    p_name: name,
    p_phone: formatPhone(phoneRaw),
    p_description: description,
  });
  if (error) {
    const text = error.message ?? "";
    if (text.includes("PIN") || text.includes("solicita") || text.includes("Ativo") || text.includes("equipamento") || text.includes("Informe") || text.includes("Descreva")) {
      return { error: text };
    }
    return { error: "Não foi possível enviar a solicitação." };
  }
  return { success: true };
}
