"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { emptyToNull } from "@/lib/address/format";
import {
  deleteError,
  mutationError,
  parseMoney,
  parseUuid,
} from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import { loadPartDetail, loadPartSetDetail } from "@/lib/inventory/queries";

function refresh() {
  revalidatePath("/inventory");
}

function parseQuantity(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!raw) return 0;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} inválida.`);
  }
  return Math.round(amount * 1000) / 1000;
}

const IMAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

function readImageUrl(formData: FormData, tenantId: string) {
  if (!formData.has("image_path")) return undefined;
  const raw = String(formData.get("image_path") ?? "").trim();
  if (!raw) return null;
  const prefix = `${tenantId}/parts/`;
  const fileName = raw.startsWith(prefix) ? raw.slice(prefix.length) : "";
  if (!IMAGE_PATH.test(fileName) || raw.includes("..")) {
    throw new Error("Imagem inválida.");
  }
  return raw;
}

function readPartFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Informe o nome da peça.");
  return {
    name,
    description: emptyToNull(formData.get("description")),
    cost: parseMoney(formData.get("cost")) ?? 0,
    quantity: parseQuantity(formData.get("quantity"), "Quantidade"),
    min_quantity: parseQuantity(formData.get("min_quantity"), "Quantidade mínima"),
    non_stock: formData.get("non_stock") === "on",
    unit: emptyToNull(formData.get("unit")),
    bar_code: emptyToNull(formData.get("bar_code")),
    area: emptyToNull(formData.get("area")),
  };
}

async function recordAdjustment(
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  input: {
    tenantId: string;
    partId: string;
    quantity: number;
    membershipId: string | null;
  },
) {
  if (input.quantity === 0) return;
  const { error } = await supabase.from("stock_movement").insert({
    tenant_id: input.tenantId,
    part_id: input.partId,
    quantity: input.quantity,
    reason: "ADJUSTMENT",
    created_by: input.membershipId,
  });
  if (error) throw new Error("Não foi possível registrar o movimento de estoque.");
}

export async function createPart(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId, appUser } = await requireArea("inventory", "edit");
  try {
    const fields = readPartFields(formData);
    const { data, error } = await supabase
      .from("part")
      .insert({
        tenant_id: tenantId,
        ...fields,
        image_url: readImageUrl(formData, tenantId) ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return { error: error ? mutationError(error) : "Não foi possível criar a peça." };
    await recordAdjustment(supabase, {
      tenantId,
      partId: data.id,
      quantity: fields.quantity,
      membershipId: appUser.membershipId,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível criar a peça.",
    };
  }
  refresh();
  return { success: true };
}

export async function updatePart(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId, appUser } = await requireArea("inventory", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Peça inválida.");
    const fields = readPartFields(formData);
    const { data: current, error: readError } = await supabase
      .from("part")
      .select("quantity")
      .eq("id", id)
      .maybeSingle();
    if (readError || !current) throw new Error("Peça não encontrada.");
    const imageUrl = readImageUrl(formData, tenantId);
    const { error } = await supabase
      .from("part")
      .update({
        ...fields,
        ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
      })
      .eq("id", id);
    if (error) return { error: mutationError(error) };
    await recordAdjustment(supabase, {
      tenantId,
      partId: id,
      quantity: Math.round((fields.quantity - Number(current.quantity)) * 1000) / 1000,
      membershipId: appUser.membershipId,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível atualizar a peça.",
    };
  }
  refresh();
  return { success: true };
}

export async function deletePart(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("inventory", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Peça inválida.");
    const { error } = await supabase.from("part").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível excluir a peça.",
    };
  }
  refresh();
  return { success: true };
}

function readSetParts(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Informe o nome do conjunto.");
  const partIds = formData
    .getAll("part_id")
    .map((value) => parseUuid(value))
    .filter((id): id is string => Boolean(id));
  return { name, partIds: [...new Set(partIds)] };
}

async function replaceSetItems(
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  tenantId: string,
  setId: string,
  partIds: string[],
) {
  const { error: clearError } = await supabase
    .from("part_set_item")
    .delete()
    .eq("part_set_id", setId);
  if (clearError) throw new Error("Não foi possível atualizar as peças do conjunto.");
  if (partIds.length === 0) return;
  const { error } = await supabase.from("part_set_item").insert(
    partIds.map((partId) => ({
      part_set_id: setId,
      part_id: partId,
      tenant_id: tenantId,
    })),
  );
  if (error) throw new Error("Não foi possível salvar as peças do conjunto.");
}

export async function createPartSet(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("inventory", "edit");
  try {
    const fields = readSetParts(formData);
    const { data, error } = await supabase
      .from("part_set")
      .insert({ tenant_id: tenantId, name: fields.name })
      .select("id")
      .single();
    if (error || !data) return { error: error ? mutationError(error) : "Não foi possível criar o conjunto." };
    await replaceSetItems(supabase, tenantId, data.id, fields.partIds);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível criar o conjunto.",
    };
  }
  refresh();
  return { success: true };
}

export async function updatePartSet(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("inventory", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Conjunto inválido.");
    const fields = readSetParts(formData);
    const { error } = await supabase.from("part_set").update({ name: fields.name }).eq("id", id);
    if (error) return { error: mutationError(error) };
    await replaceSetItems(supabase, tenantId, id, fields.partIds);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível atualizar o conjunto.",
    };
  }
  refresh();
  return { success: true };
}

export async function deletePartSet(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("inventory", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Conjunto inválido.");
    const { error } = await supabase.from("part_set").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível excluir o conjunto.",
    };
  }
  refresh();
  return { success: true };
}

export async function fetchPartDetail(partId: string) {
  try {
    await requireArea("inventory", "view");
    const id = parseUuid(partId);
    if (!id) throw new Error("Peça inválida.");
    return await loadPartDetail(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível carregar a peça.",
    };
  }
}

export async function fetchPartSetDetail(setId: string) {
  try {
    await requireArea("inventory", "view");
    const id = parseUuid(setId);
    if (!id) throw new Error("Conjunto inválido.");
    return await loadPartSetDetail(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível carregar o conjunto.",
    };
  }
}
