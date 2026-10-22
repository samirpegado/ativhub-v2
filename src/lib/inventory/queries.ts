import { requireTenant } from "@/lib/auth/current-user";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { InventoryListQuery } from "@/lib/inventory/list-params";
import {
  readPartDetail,
  readPartSetDetail,
  readPartSetsScreen,
  readPartsScreen,
} from "@/lib/inventory/payload";

export type {
  PartCategory,
  PartDetail,
  PartOption,
  PartRecord,
  PartSetDetail,
  PartSetRecord,
  PartSetsScreen,
  PartWorkOrder,
  PartsScreen,
  StockMovement,
} from "@/lib/inventory/payload";

export async function listPartsScreen(query: InventoryListQuery) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("parts_screen", {
    p_search: query.search || undefined,
    p_stock: query.stock ?? undefined,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
  });
  if (error) throw new Error("Não foi possível carregar as peças.");
  return readPartsScreen(supabase, data);
}

export async function loadPartDetail(partId: string) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("part_detail", { p_part_id: partId });
  if (error) throw new Error("Não foi possível carregar a peça.");
  return readPartDetail(supabase, data);
}

export async function listPartSetsScreen(query: InventoryListQuery) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("part_sets_screen", {
    p_search: query.search || undefined,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
  });
  if (error) throw new Error("Não foi possível carregar os conjuntos.");
  return readPartSetsScreen(data);
}

export async function loadPartSetDetail(setId: string) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("part_set_detail", { p_set_id: setId });
  if (error) throw new Error("Não foi possível carregar o conjunto.");
  return readPartSetDetail(data);
}
