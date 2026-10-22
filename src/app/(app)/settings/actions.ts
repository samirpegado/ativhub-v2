"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { MENU_AREAS, type AreaAccess, type MenuArea } from "@/lib/auth/areas";
import type { MutationState } from "@/lib/forms/state";
import { isAssignableRole } from "@/lib/people/roles";

function cell(view: boolean, edit: boolean) {
  return { view: view || edit, edit };
}

export async function updateRoles(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireAdmin();
  try {
    const { data, error } = await supabase.from("role").select("id, code, permissions");
    if (error || !data) return { error: "Não foi possível carregar as funções." };

    for (const role of data) {
      if (!isAssignableRole(role.code)) continue;
      const description = String(formData.get(`description_${role.code}`) ?? "").trim();
      if (description.length > 280) return { error: "A descrição deve ter no máximo 280 caracteres." };
      const areas = {} as AreaAccess;
      for (const area of MENU_AREAS) {
        const edit = role.code === "ADMIN" || formData.get(`${role.code}_${area}_edit`) === "on";
        const view = role.code === "ADMIN" || edit || formData.get(`${role.code}_${area}_view`) === "on";
        areas[area as MenuArea] = cell(view, edit);
      }
      const current =
        role.permissions && typeof role.permissions === "object" && !Array.isArray(role.permissions)
          ? role.permissions
          : {};
      const { error: updateError } = await supabase
        .from("role")
        .update({
          description: description || null,
          permissions: { ...current, areas },
        })
        .eq("id", role.id);
      if (updateError) return { error: "Não foi possível salvar as funções." };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar as funções.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}
