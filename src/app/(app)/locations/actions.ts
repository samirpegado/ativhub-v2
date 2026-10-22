"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import {
  addressFromForm,
  deleteError,
  mutationError,
  parseUuid,
} from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";

function readLocationFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Informe o nome da localização.");
  }

  return {
    name,
    ...addressFromForm(formData),
  };
}

export async function createLocation(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("locations", "edit");

  try {
    const fields = readLocationFields(formData);
    const { error } = await supabase.from("location").insert({
      tenant_id: tenantId,
      ...fields,
    });
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a localização.",
    };
  }

  revalidatePath("/locations");
  return { success: true } as const;
}

export async function updateLocation(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("locations", "edit");

  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Localização inválida.");
    const fields = readLocationFields(formData);
    const { error } = await supabase
      .from("location")
      .update(fields)
      .eq("id", id);
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a localização.",
    };
  }

  revalidatePath("/locations");
  return { success: true } as const;
}

export async function deleteLocation(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("locations", "edit");

  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Localização inválida.");
    const { error } = await supabase.from("location").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a localização.",
    };
  }

  revalidatePath("/locations");
  revalidatePath("/assets");
}
