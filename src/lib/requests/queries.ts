import { requireArea } from "@/lib/auth/permissions";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { RequestListQuery } from "@/lib/requests/list-params";
import { isRequestKind, type RequestKind } from "@/lib/requests/kind";
import { readRequestsScreen } from "@/lib/requests/payload";
import { signStoragePath } from "@/lib/storage/signed-url";

export type { RequestRecord } from "@/lib/requests/payload";

export async function countPendingRequests() {
  try {
    const { supabase } = await requireArea("requests", "view");
    const { count, error } = await supabase
      .from("request")
      .select("id", { count: "exact", head: true })
      .eq("cancelled", false)
      .eq("in_treatment", false)
      .is("work_order_id", null)
      .is("read_at", null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export type RequestDetail = {
  id: string;
  customId: string | null;
  title: string;
  description: string | null;
  requesterName: string | null;
  requesterPhone: string | null;
  createdAt: string;
  cancelled: boolean;
  cancellationReason: string | null;
  workOrderId: string | null;
  workOrderCustomId: string | null;
  assetId: string | null;
  assetName: string | null;
  locationName: string | null;
  kind: RequestKind;
  imagePath: string | null;
  imageUrl: string | null;
  inTreatment: boolean;
};

function relatedName(value: { name: string | null } | { name: string | null }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? null;
}

function relatedCustomId(value: { custom_id: string | null } | { custom_id: string | null }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.custom_id ?? null;
}

export async function markRequestRead(id: string) {
  const { supabase, appUser } = await requireArea("requests", "view");
  if (!appUser.isAdmin) return;
  await supabase.from("request").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
}

export async function loadRequestDetail(id: string): Promise<RequestDetail | null> {
  const { supabase } = await requireArea("requests", "view");
  const { data, error } = await supabase
    .from("request")
    .select("id, custom_id, title, description, requester_name, requester_phone, created_at, cancelled, cancellation_reason, work_order_id, asset_id, kind, image_url, in_treatment, asset:asset_id(name), location:location_id(name), work_order:work_order_id(custom_id)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const kind = isRequestKind(data.kind) ? data.kind : "SERVICE";
  return {
    id: data.id,
    customId: data.custom_id,
    title: data.title,
    description: data.description,
    requesterName: data.requester_name,
    requesterPhone: data.requester_phone,
    createdAt: data.created_at,
    cancelled: data.cancelled,
    cancellationReason: data.cancellation_reason,
    workOrderId: data.work_order_id,
    workOrderCustomId: relatedCustomId(data.work_order),
    assetId: data.asset_id,
    assetName: relatedName(data.asset),
    locationName: relatedName(data.location),
    kind,
    imagePath: data.image_url,
    imageUrl: await signStoragePath(supabase, data.image_url),
    inTreatment: data.in_treatment,
  };
}

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
