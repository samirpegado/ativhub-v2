import { requireArea } from "@/lib/auth/permissions";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { PartyListQuery } from "@/lib/parties/list-params";
import { readCustomersScreen, readVendorsScreen } from "@/lib/parties/payload";

export type { CustomerRecord, VendorRecord } from "@/lib/parties/payload";

export async function listVendorsScreen(query: PartyListQuery) {
  const { supabase } = await requireArea("parties", "view");
  const { data, error } = await supabase.rpc("vendors_screen", {
    p_search: query.search || undefined,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
  });
  if (error) throw new Error("Não foi possível carregar os fornecedores.");
  return readVendorsScreen(data);
}

export async function listCustomersScreen(query: PartyListQuery) {
  const { supabase } = await requireArea("parties", "view");
  const { data, error } = await supabase.rpc("customers_screen", {
    p_search: query.search || undefined,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
  });
  if (error) throw new Error("Não foi possível carregar os contratantes.");
  return readCustomersScreen(data);
}
