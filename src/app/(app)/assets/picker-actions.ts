"use server";

import { can } from "@/lib/auth/areas";
import { requireTenant } from "@/lib/auth/current-user";
import { loadPickerSelection, type AssetPickerHit, type AssetPickerQuery } from "@/lib/assets/picker";

export async function searchPickerAssets(input: AssetPickerQuery & {
  selectedIds: string[];
}): Promise<{ results: AssetPickerHit[]; selected: AssetPickerHit[] }> {
  const { supabase, appUser } = await requireTenant();
  const allowed = (["assets", "work_orders", "requests", "preventive"] as const).some((area) =>
    can(appUser, area, "view"),
  );
  if (!allowed) throw new Error("Você não tem permissão para buscar ativos.");
  return loadPickerSelection(supabase, input, input.selectedIds);
}
