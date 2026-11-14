import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSET_STATUSES, type AssetStatus } from "@/lib/assets/status";
import { narrowsAssetList } from "@/lib/assets/list-params";
import type { Database } from "@/lib/supabase/database.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_VALUES = ASSET_STATUSES.map((item) => item.value);
const PAGE_SIZE = 1000;

export type AssetPickerHit = {
  id: string;
  name: string;
  customId: string | null;
  locationId: string | null;
  customerId: string | null;
  locationLabel: string | null;
};

export type AssetPickerQuery = {
  term: string;
  statuses: string[];
  categoryIds: string[];
  locationIds: string[];
};

type LocationEmbed = {
  id: string | null;
  name: string | null;
  custom_id: string | null;
  customer_id: string | null;
};

type AssetRow = {
  id: string;
  name: string | null;
  custom_id: string | null;
  location: LocationEmbed | LocationEmbed[] | null;
};

function cleanTerm(term: string) {
  return term.trim().replace(/[%_\\,]/g, "").slice(0, 80);
}

export function pickerIds(ids: string[]) {
  return [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, 50);
}

function isStatus(value: string): value is AssetStatus {
  return ASSET_STATUSES.some((item) => item.value === value);
}

export function toAssetPickerHit(row: AssetRow): AssetPickerHit[] {
  if (!row.name) return [];
  const location = Array.isArray(row.location) ? row.location[0] : row.location;
  const locationLabel = location?.name
    ? location.custom_id
      ? `${location.custom_id} · ${location.name}`
      : location.name
    : null;
  return [{
    id: row.id,
    name: row.name,
    customId: row.custom_id,
    locationId: location?.id ?? null,
    customerId: location?.customer_id ?? null,
    locationLabel,
  }];
}

export async function queryPickerAssets(
  supabase: SupabaseClient<Database>,
  input: AssetPickerQuery,
): Promise<AssetPickerHit[]> {
  const text = cleanTerm(input.term);
  const statuses = input.statuses.filter(isStatus);
  const categoryIds = pickerIds(input.categoryIds);
  const locationIds = pickerIds(input.locationIds);
  const rows: AssetRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let request = supabase
      .from("asset")
      .select("id, name, custom_id, location:location_id(id, name, custom_id, customer_id)")
      .eq("archived", false)
      .order("name")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (narrowsAssetList(statuses, STATUS_VALUES)) request = request.in("status", statuses);
    if (categoryIds.length > 0) request = request.in("category_id", categoryIds);
    if (locationIds.length > 0) request = request.in("location_id", locationIds);
    if (text) {
      request = request.or(
        `name.ilike.%${text}%,custom_id.ilike.%${text}%,description.ilike.%${text}%,model.ilike.%${text}%,serial_number.ilike.%${text}%,area.ilike.%${text}%,bar_code.ilike.%${text}%`,
      );
    }
    const { data, error } = await request;
    if (error) break;
    const batch = (data ?? []) as AssetRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows.flatMap(toAssetPickerHit);
}

export async function loadAssetPickerHit(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AssetPickerHit | null> {
  if (!UUID.test(id)) return null;
  const { data } = await supabase
    .from("asset")
    .select("id, name, custom_id, location:location_id(id, name, custom_id, customer_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return toAssetPickerHit(data as AssetRow)[0] ?? null;
}

export async function loadPickerSelection(
  supabase: SupabaseClient<Database>,
  input: AssetPickerQuery,
  selectedIds: string[],
): Promise<{ results: AssetPickerHit[]; selected: AssetPickerHit[] }> {
  const ids = pickerIds(selectedIds);
  const results = await queryPickerAssets(supabase, input);
  const missing = ids.filter((id) => !results.some((item) => item.id === id));
  if (missing.length === 0) {
    return { results, selected: results.filter((item) => ids.includes(item.id)) };
  }
  const extra = await supabase
    .from("asset")
    .select("id, name, custom_id, location:location_id(id, name, custom_id, customer_id)")
    .in("id", missing);
  const selected = [...((extra.data ?? []) as AssetRow[]).flatMap(toAssetPickerHit), ...results.filter((item) => ids.includes(item.id))];
  return { results, selected };
}
