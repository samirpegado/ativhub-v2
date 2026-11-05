import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export function isStoppedAssetStatus(status: string) {
  return status === "DOWN" || status === "EMERGENCY_SHUTDOWN";
}

/** Abre parada ao entrar em fora de serviço e fecha ao voltar para operacional. */
export async function syncAssetDowntime(
  supabase: Client,
  input: {
    tenantId: string;
    assetId: string;
    previous: string;
    next: string;
    at: string;
    workOrderId?: string | null;
  },
) {
  if (input.previous === input.next) return;
  const when = new Date(input.at);
  if (Number.isNaN(when.getTime())) throw new Error("Data do status do ativo inválida.");
  const at = when.toISOString();

  if (input.next === "OPERATIONAL") {
    const { data: openRows, error } = await supabase
      .from("asset_downtime")
      .select("id, started_at")
      .eq("asset_id", input.assetId)
      .is("ended_at", null)
      .eq("duration_seconds", 0);
    if (error) throw new Error("Não foi possível registrar a parada do ativo.");
    for (const row of openRows ?? []) {
      const started = new Date(row.started_at).getTime();
      const seconds = Number.isFinite(started)
        ? Math.max(0, Math.floor((when.getTime() - started) / 1000))
        : 0;
      const { error: closeError } = await supabase
        .from("asset_downtime")
        .update({ ended_at: at, duration_seconds: seconds })
        .eq("id", row.id);
      if (closeError) throw new Error("Não foi possível encerrar a parada do ativo.");
    }
    return;
  }

  if (!isStoppedAssetStatus(input.next) || isStoppedAssetStatus(input.previous)) return;

  const { data: existing, error: openError } = await supabase
    .from("asset_downtime")
    .select("id")
    .eq("asset_id", input.assetId)
    .is("ended_at", null)
    .eq("duration_seconds", 0)
    .limit(1);
  if (openError) throw new Error("Não foi possível registrar a parada do ativo.");
  if (existing && existing.length > 0) return;

  const { error: insertError } = await supabase.from("asset_downtime").insert({
    tenant_id: input.tenantId,
    asset_id: input.assetId,
    started_at: at,
    duration_seconds: 0,
    ended_at: null,
    work_order_id: input.workOrderId ?? null,
  });
  if (insertError) throw new Error("Não foi possível registrar a parada do ativo.");
}
