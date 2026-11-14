"use server";

import { requireArea } from "@/lib/auth/permissions";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function resolveAssetScan(raw: string): Promise<{ id: string } | { error: string }> {
  const text = raw.trim();
  if (!text) return { error: "QR code vazio." };
  const { supabase } = await requireArea("assets", "view");
  const id = text.match(UUID)?.[0] ?? null;
  if (id) {
    const { data, error } = await supabase.from("asset").select("id").eq("id", id).maybeSingle();
    if (error) return { error: "Não foi possível localizar o ativo." };
    if (data) return { id: data.id };
    return { error: "Nenhum ativo encontrado para este QR code." };
  }

  const { data, error } = await supabase.from("asset").select("id").eq("bar_code", text).limit(2);
  if (error) return { error: "Não foi possível localizar o ativo." };
  if (data?.length === 1) return { id: data[0].id };
  if ((data?.length ?? 0) > 1) return { error: "Mais de um ativo usa este código." };
  return { error: "Nenhum ativo encontrado para este QR code." };
}
