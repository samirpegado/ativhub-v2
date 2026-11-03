"use server";

import { revalidatePath } from "next/cache";
import { ASSET_CATEGORY_TYPE } from "@/lib/categories/queries";
import { requireAdmin } from "@/lib/auth/permissions";
import { deleteError, mutationError, parseUuid } from "@/lib/forms/parse";

export type CategoryPayload = {
  id: string;
  name: string;
  color: string | null;
};

export type CategoryMutation =
  | { success: true; category?: CategoryPayload; error?: never }
  | { error: string; success?: never; category?: never }
  | undefined;

const COLOR = /^#[0-9a-fA-F]{6}$/;

function readCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) throw new Error("Informe o nome da categoria.");

  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = colorRaw ? colorRaw : null;
  if (color && !COLOR.test(color)) throw new Error("Cor inválida.");

  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 280) throw new Error("A descrição deve ter no máximo 280 caracteres.");

  return { name, color, description: description || null };
}

async function nameTaken(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  name: string,
  ignoreId?: string,
) {
  const { data } = await supabase
    .from("category")
    .select("id, name")
    .eq("type", ASSET_CATEGORY_TYPE);
  return (data ?? []).some(
    (row) => row.id !== ignoreId && row.name.toLowerCase() === name.toLowerCase(),
  );
}

export async function createCategory(
  _prev: CategoryMutation,
  formData: FormData,
): Promise<CategoryMutation> {
  const { supabase, tenantId } = await requireAdmin();
  try {
    const fields = readCategory(formData);
    if (await nameTaken(supabase, fields.name)) {
      return { error: "Já existe uma categoria com este nome." };
    }
    const { data, error } = await supabase
      .from("category")
      .insert({ tenant_id: tenantId, type: ASSET_CATEGORY_TYPE, ...fields })
      .select("id, name, color")
      .single();
    if (error || !data) return { error: mutationError(error ?? {}) };
    revalidatePath("/settings");
    revalidatePath("/assets");
    return { success: true, category: data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a categoria." };
  }
}

export async function updateCategory(
  _prev: CategoryMutation,
  formData: FormData,
): Promise<CategoryMutation> {
  const { supabase } = await requireAdmin();
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Categoria inválida.");
    const fields = readCategory(formData);
    if (await nameTaken(supabase, fields.name, id)) {
      return { error: "Já existe uma categoria com este nome." };
    }
    const { error } = await supabase
      .from("category")
      .update(fields)
      .eq("id", id)
      .eq("type", ASSET_CATEGORY_TYPE);
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar a categoria." };
  }
  revalidatePath("/settings");
  revalidatePath("/assets");
  return { success: true };
}

export async function deleteCategory(
  _prev: CategoryMutation,
  formData: FormData,
): Promise<CategoryMutation> {
  const { supabase } = await requireAdmin();
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Categoria inválida.");
    const { error } = await supabase
      .from("category")
      .delete()
      .eq("id", id)
      .eq("type", ASSET_CATEGORY_TYPE);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir a categoria." };
  }
  revalidatePath("/settings");
  revalidatePath("/assets");
  return { success: true };
}
