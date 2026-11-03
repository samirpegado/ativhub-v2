import { requireTenant } from "@/lib/auth/current-user";

export const ASSET_CATEGORY_TYPE = "ASSET";

export type AssetCategory = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
};

export async function listAssetCategories(): Promise<AssetCategory[]> {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase
    .from("category")
    .select("id, name, color, description")
    .eq("type", ASSET_CATEGORY_TYPE)
    .order("name");

  if (error) throw new Error("Não foi possível carregar as categorias.");
  return data ?? [];
}
