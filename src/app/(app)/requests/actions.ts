"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { parseUuid } from "@/lib/forms/parse";

function refresh() {
  revalidatePath("/requests");
  revalidatePath("/");
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function approveRequest(requestId: string): Promise<{ error: string } | { ok: true }> {
  try {
    const { supabase } = await requireArea("requests", "edit");
    const id = parseUuid(requestId);
    if (!id) throw new Error("Solicitação inválida.");
    const { error } = await supabase.rpc("approve_request", { p_request_id: id });
    if (error) throw new Error(error.message || "Não foi possível aprovar a solicitação.");
  } catch (error) {
    return { error: message(error, "Não foi possível aprovar a solicitação.") };
  }
  refresh();
  return { ok: true };
}

export async function rejectRequest(
  requestId: string,
  reason: string,
): Promise<{ error: string } | { ok: true }> {
  try {
    const { supabase } = await requireArea("requests", "edit");
    const id = parseUuid(requestId);
    const text = reason.trim();
    if (!id) throw new Error("Solicitação inválida.");
    if (!text) throw new Error("Informe o motivo da recusa.");
    const { data, error } = await supabase
      .from("request")
      .update({ cancelled: true, cancellation_reason: text })
      .eq("id", id)
      .eq("cancelled", false)
      .is("work_order_id", null)
      .select("id");
    if (error) throw new Error("Não foi possível recusar a solicitação.");
    if (!data?.length) throw new Error("Esta solicitação já foi tratada.");
  } catch (error) {
    return { error: message(error, "Não foi possível recusar a solicitação.") };
  }
  refresh();
  return { ok: true };
}
