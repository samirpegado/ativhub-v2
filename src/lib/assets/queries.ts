import { requireArea } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/auth/current-user";
import { readAssetDetail } from "@/lib/assets/detail";
import type { AssetListQuery } from "@/lib/assets/list-params";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { relationName } from "@/lib/forms/parse";
import { signStoragePaths } from "@/lib/storage/signed-url";

export type AssetRecord = {
  id: string;
  custom_id: string | null;
  name: string;
  description: string | null;
  location_id: string | null;
  locationName: string | null;
  category_id: string | null;
  categoryName: string | null;
  status: string;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  bar_code: string | null;
  power: string | null;
  area: string | null;
  acquisition_cost: number | null;
  in_service_date: string | null;
  warranty_expiration_date: string | null;
  additional_infos: string | null;
  image_url: string | null;
  imageUrl: string | null;
};

export async function listAssetOptions() {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase
    .from("asset")
    .select("id, custom_id, name, location_id")
    .eq("archived", false)
    .order("name");

  if (error) {
    throw new Error("Não foi possível carregar os ativos.");
  }

  return data ?? [];
}

export async function listAssets() {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase
    .from("asset")
    .select(
      "id, custom_id, name, description, location_id, category_id, status, model, manufacturer, serial_number, bar_code, power, area, acquisition_cost, in_service_date, warranty_expiration_date, additional_infos, image_url, location:location_id(name), category:category_id(name)",
    )
    .eq("archived", false)
    .order("name");

  if (error) {
    throw new Error("Não foi possível carregar os ativos.");
  }

  const rows = data ?? [];
  const imageUrls = await signStoragePaths(
    supabase,
    rows.map((row) => row.image_url),
  );

  return rows.map((row, index) => ({
    id: row.id,
    custom_id: row.custom_id,
    name: row.name,
    description: row.description,
    location_id: row.location_id,
    locationName: relationName(
      row.location as { name: string } | { name: string }[] | null,
    ),
    category_id: row.category_id,
    categoryName: relationName(
      row.category as { name: string } | { name: string }[] | null,
    ),
    status: row.status,
    model: row.model,
    manufacturer: row.manufacturer,
    serial_number: row.serial_number,
    bar_code: row.bar_code,
    power: row.power,
    area: row.area,
    acquisition_cost: row.acquisition_cost,
    in_service_date: row.in_service_date,
    warranty_expiration_date: row.warranty_expiration_date,
    additional_infos: row.additional_infos,
    image_url: row.image_url,
    imageUrl: imageUrls[index] ?? null,
  })) satisfies AssetRecord[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function num(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countOf(value: unknown) {
  return num(value) ?? 0;
}

export async function listAssetsScreen(query: AssetListQuery) {
  const { supabase } = await requireArea("assets", "view");
  const { data, error } = await supabase.rpc("assets_screen", {
    p_search: query.search || undefined,
    p_statuses: query.statuses.length > 0 ? query.statuses : undefined,
    p_category_ids: query.categoryIds.length > 0 ? query.categoryIds : undefined,
    p_location_ids: query.locationIds.length > 0 ? query.locationIds : undefined,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
  });
  if (error) throw new Error("Não foi possível carregar os ativos.");
  const screen = asRecord(data);
  const rows = Array.isArray(screen?.items) ? screen.items : [];
  const items = rows.flatMap((item) => {
    const row = asRecord(item);
    const id = text(row?.id);
    const name = text(row?.name);
    const status = text(row?.status);
    if (!row || !id || !name || !status) return [];
    return [
      {
        id,
        custom_id: text(row.customId),
        name,
        description: text(row.description),
        location_id: text(row.locationId),
        locationName: text(row.locationName),
        category_id: text(row.categoryId),
        categoryName: text(row.categoryName),
        status,
        model: text(row.model),
        manufacturer: text(row.manufacturer),
        serial_number: text(row.serialNumber),
        bar_code: text(row.barCode),
        power: text(row.power),
        area: text(row.area),
        acquisition_cost: num(row.acquisitionCost),
        in_service_date: text(row.inServiceDate),
        warranty_expiration_date: text(row.warrantyExpirationDate),
        additional_infos: text(row.additionalInfos),
        image_url: text(row.imagePath),
        imageUrl: null,
      } satisfies AssetRecord,
    ];
  });
  const imageUrls = await signStoragePaths(
    supabase,
    items.map((item) => item.image_url),
  );
  return {
    items: items.map((item, index) => ({ ...item, imageUrl: imageUrls[index] ?? null })),
    total: countOf(screen?.total),
    totalAll: countOf(screen?.totalAll),
  };
}

export async function loadAssetDetail(assetId: string) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("asset_detail", { p_asset_id: assetId });
  if (error || data == null) throw new Error("Não foi possível carregar o ativo.");
  return readAssetDetail(supabase, data);
}
