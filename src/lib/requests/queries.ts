import { requireArea } from "@/lib/auth/permissions";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { RequestListQuery } from "@/lib/requests/list-params";
import { readRequestsScreen } from "@/lib/requests/payload";

export type { RequestRecord } from "@/lib/requests/payload";

export async function listRequestsScreen(query: RequestListQuery) {
  const { supabase } = await requireArea("requests", "view");
  const { data, error } = await supabase.rpc("requests_screen", {
    p_search: query.search || undefined,
    p_status: query.status ?? undefined,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
  });
  if (error) throw new Error("Não foi possível carregar as solicitações.");
  return readRequestsScreen(data);
}
