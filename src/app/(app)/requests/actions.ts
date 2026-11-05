"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireArea } from "@/lib/auth/permissions";
import { parseUuid } from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import { loadWorkOrderEditor, type WorkOrderEditorData } from "@/lib/work-orders/queries";

function refresh() {
  revalidatePath("/requests");
  revalidatePath("/", "layout");
}

function parseIdList(ids: string[]) {
  const unique = [...new Set(ids.flatMap((id) => {
    const parsed = parseUuid(id);
    return parsed ? [parsed] : [];
  }))];
  if (unique.length === 0) throw new Error("Selecione uma solicitação.");
  return unique;
}

function requestFields(formData: FormData) {
  const titleInput = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const title = titleInput || description.slice(0, 120);
  const assetId = parseUuid(formData.get("asset_id"));
  if (!assetId) throw new Error("Selecione o ativo.");
  if (!description) throw new Error("Descreva o que aconteceu.");
  if (title.length > 200) throw new Error("O título deve ter no máximo 200 caracteres.");
  return { title, description, assetId };
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function approveRequest(
  requestId: string,
): Promise<{ error: string } | { ok: true; editor: WorkOrderEditorData }> {
  try {
    const { supabase } = await requireAdmin();
    const id = parseUuid(requestId);
    if (!id) throw new Error("Solicitação inválida.");
    const { data, error } = await supabase.rpc("approve_request", { p_request_id: id });
    if (error || !data) throw new Error(error?.message || "Não foi possível aprovar a solicitação.");
    refresh();
    try {
      const editor = await loadWorkOrderEditor(data);
      return { ok: true, editor };
    } catch {
      return { error: "A ordem foi criada. Abra Ordens de serviço para completar os dados." };
    }
  } catch (error) {
    return { error: message(error, "Não foi possível aprovar a solicitação.") };
  }
}

export async function rejectRequest(
  requestId: string,
  reason: string,
): Promise<{ error: string } | { ok: true }> {
  try {
    const { supabase } = await requireAdmin();
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

async function assetLocation(assetId: string) {
  const { supabase } = await requireArea("requests", "edit");
  const { data: asset, error } = await supabase
    .from("asset")
    .select("id, location_id")
    .eq("id", assetId)
    .maybeSingle();
  if (error || !asset) throw new Error("Ativo inválido.");
  return { supabase, asset };
}

export async function createRequest(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { tenantId, appUser } = await requireArea("requests", "edit");
  try {
    const fields = requestFields(formData);
    const { supabase, asset } = await assetLocation(fields.assetId);
    const { error } = await supabase.from("request").insert({
      tenant_id: tenantId,
      title: fields.title,
      description: fields.description,
      priority: "NONE",
      asset_id: asset.id,
      location_id: asset.location_id,
      requester_name: appUser.displayName,
    });
    if (error) throw new Error("Não foi possível criar a solicitação.");
  } catch (error) {
    return { error: message(error, "Não foi possível criar a solicitação.") };
  }
  refresh();
  return { success: true };
}

export async function updateRequest(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Solicitação inválida.");
    const fields = requestFields(formData);
    const { supabase, asset } = await assetLocation(fields.assetId);
    const { data, error } = await supabase
      .from("request")
      .update({
        title: fields.title,
        description: fields.description,
        asset_id: asset.id,
        location_id: asset.location_id,
      })
      .eq("id", id)
      .eq("cancelled", false)
      .is("work_order_id", null)
      .select("id");
    if (error) throw new Error("Não foi possível salvar a solicitação.");
    if (!data?.length) throw new Error("Só é possível editar uma solicitação pendente.");
  } catch (error) {
    return { error: message(error, "Não foi possível salvar a solicitação.") };
  }
  refresh();
  return { success: true };
}

export async function deleteRequests(ids: string[]): Promise<MutationState> {
  try {
    const unique = parseIdList(ids);
    const { supabase } = await requireArea("requests", "edit");
    const { data, error } = await supabase
      .from("request")
      .delete()
      .in("id", unique)
      .eq("cancelled", false)
      .is("work_order_id", null)
      .select("id");
    if (error) throw new Error("Não foi possível excluir as solicitações.");
    if (!data?.length) throw new Error("Só é possível excluir solicitações pendentes.");
  } catch (error) {
    return { error: message(error, "Não foi possível excluir as solicitações.") };
  }
  refresh();
  return { success: true };
}
