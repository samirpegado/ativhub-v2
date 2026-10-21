import { requireTenant } from "@/lib/auth/current-user";
import { relationName } from "@/lib/forms/parse";
import { signStoragePaths } from "@/lib/storage/signed-url";

export type AssetRecord = {
  id: string;
  custom_id: string | null;
  name: string;
  description: string | null;
  location_id: string | null;
  locationName: string | null;
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
      "id, custom_id, name, description, location_id, status, model, manufacturer, serial_number, bar_code, power, area, acquisition_cost, in_service_date, warranty_expiration_date, additional_infos, image_url, location:location_id(name)",
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
