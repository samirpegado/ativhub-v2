"use server";

import { requireArea } from "@/lib/auth/permissions";
import {
  loadPickerSelection,
  queryPickerAssets,
  type AssetPickerHit,
  type AssetPickerQuery,
} from "@/lib/assets/picker";

export type PreventiveAssetHit = AssetPickerHit;

export async function selectFilteredPreventiveAssets(input: AssetPickerQuery): Promise<PreventiveAssetHit[]> {
  const { supabase } = await requireArea("preventive", "view");
  return queryPickerAssets(supabase, input);
}

export async function searchPreventiveAssets(input: AssetPickerQuery & {
  selectedIds: string[];
}): Promise<{ results: PreventiveAssetHit[]; selected: PreventiveAssetHit[] }> {
  const { supabase } = await requireArea("preventive", "view");
  return loadPickerSelection(supabase, input, input.selectedIds);
}
