"use server";

import { revalidatePath } from "next/cache";
import { assetsToCsv, readAssetCsv, type AssetCsvRow } from "@/lib/assets/csv";
import { ASSET_CATEGORY_TYPE } from "@/lib/categories/queries";
import { requireArea } from "@/lib/auth/permissions";
import { relationName } from "@/lib/forms/parse";

export type AssetImportResult = {
  created: number;
  updated: number;
  locationsCreated: number;
  categoriesCreated: number;
  errors: { line: number; message: string }[];
};

const MAX_ROWS = 500;

function randomCategoryColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 0.62;
  const lightness = 0.46;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const match =
    sector < 1 ? [chroma, x, 0] :
    sector < 2 ? [x, chroma, 0] :
    sector < 3 ? [0, chroma, x] :
    sector < 4 ? [0, x, chroma] :
    sector < 5 ? [x, 0, chroma] :
    [chroma, 0, x];
  const shift = lightness - chroma / 2;
  const hex = (channel: number) => Math.round((channel + shift) * 255).toString(16).padStart(2, "0");
  return `#${hex(match[0])}${hex(match[1])}${hex(match[2])}`;
}

export async function exportAssetsCsv(): Promise<{ csv: string } | { error: string }> {
  const { supabase } = await requireArea("assets", "view");
  const { data, error } = await supabase
    .from("asset")
    .select(
      "custom_id, name, status, area, model, manufacturer, serial_number, bar_code, power, acquisition_cost, in_service_date, warranty_expiration_date, description, additional_infos, location:location_id(name), category:category_id(name)",
    )
    .eq("archived", false)
    .order("name");
  if (error) return { error: "Não foi possível exportar os ativos." };
  return {
    csv: assetsToCsv(
    (data ?? []).map((row) => ({
      customId: row.custom_id,
      name: row.name,
      status: row.status,
      locationName: relationName(row.location as { name: string } | { name: string }[] | null),
      categoryName: relationName(row.category as { name: string } | { name: string }[] | null),
      area: row.area,
      model: row.model,
      manufacturer: row.manufacturer,
      serialNumber: row.serial_number,
      barCode: row.bar_code,
      power: row.power,
      acquisitionCost: row.acquisition_cost,
      inServiceDate: row.in_service_date,
      warrantyExpirationDate: row.warranty_expiration_date,
      description: row.description,
      additionalInfos: row.additional_infos,
    })),
    ),
  };
}

function columns(row: AssetCsvRow, locationId: string | null, categoryId: string | null) {
  return {
    name: row.name,
    status: row.status,
    location_id: locationId,
    category_id: categoryId,
    area: row.area,
    model: row.model,
    manufacturer: row.manufacturer,
    serial_number: row.serialNumber,
    bar_code: row.barCode,
    power: row.power,
    acquisition_cost: row.acquisitionCost,
    in_service_date: row.inServiceDate,
    warranty_expiration_date: row.warrantyExpirationDate,
    description: row.description,
    additional_infos: row.additionalInfos,
  };
}

export async function importAssetsCsv(csv: string): Promise<AssetImportResult> {
  const { supabase, tenantId } = await requireArea("assets", "edit");
  if (csv.length > 1_000_000) {
    return { created: 0, updated: 0, locationsCreated: 0, categoriesCreated: 0, errors: [{ line: 1, message: "O arquivo é grande demais." }] };
  }
  const parsed = readAssetCsv(csv);
  if (parsed.rows.length + parsed.errors.length > MAX_ROWS) {
    return {
      created: 0,
      updated: 0,
      locationsCreated: 0, categoriesCreated: 0,
      errors: [{ line: 1, message: `Importe no máximo ${MAX_ROWS} linhas por vez.` }],
    };
  }
  if (parsed.errors.some((item) => item.line === 1)) {
    return { created: 0, updated: 0, locationsCreated: 0, categoriesCreated: 0, errors: parsed.errors };
  }

  const [locations, categories, assets] = await Promise.all([
    supabase.from("location").select("id, name"),
    supabase.from("category").select("id, name").eq("type", ASSET_CATEGORY_TYPE),
    supabase.from("asset").select("id, custom_id"),
  ]);
  if (locations.error || categories.error || assets.error) {
    return { created: 0, updated: 0, locationsCreated: 0, categoriesCreated: 0, errors: [{ line: 1, message: "Não foi possível ler os cadastros." }] };
  }

  const byCode = new Map<string, string>();
  for (const asset of assets.data ?? []) {
    if (asset.custom_id) byCode.set(asset.custom_id, asset.id);
  }

  const knownLocations = [...(locations.data ?? [])];
  const knownCategories = [...(categories.data ?? [])];
  let created = 0;
  let updated = 0;
  let locationsCreated = 0;
  let categoriesCreated = 0;
  const errors = [...parsed.errors];

  async function locationIdFor(name: string | null) {
    if (!name) return null;
    const found = knownLocations.filter((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (found.length > 1) throw new Error("Há mais de uma localização com este nome.");
    if (found.length === 1) return found[0].id;
    const { data, error } = await supabase
      .from("location")
      .insert({ tenant_id: tenantId, name })
      .select("id, name")
      .single();
    if (error || !data) throw new Error("Não foi possível criar a localização.");
    knownLocations.push(data);
    locationsCreated += 1;
    return data.id;
  }

  async function categoryIdFor(name: string | null) {
    if (!name) return null;
    const found = knownCategories.filter((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (found.length > 1) throw new Error("Há mais de uma categoria com este nome.");
    if (found.length === 1) return found[0].id;
    const { data, error } = await supabase
      .from("category")
      .insert({ tenant_id: tenantId, type: ASSET_CATEGORY_TYPE, name, color: randomCategoryColor() })
      .select("id, name")
      .single();
    if (error || !data) throw new Error("Não foi possível criar a categoria.");
    knownCategories.push(data);
    categoriesCreated += 1;
    return data.id;
  }

  for (const row of parsed.rows) {
    try {
      const categoryId = await categoryIdFor(row.categoryName);
      const locationId = await locationIdFor(row.locationName);
      const fields = columns(row, locationId, categoryId);
      const existingId = row.customId ? byCode.get(row.customId) : undefined;
      if (existingId) {
        const { error } = await supabase.from("asset").update(fields).eq("id", existingId);
        if (error) throw new Error("Não foi possível atualizar o ativo.");
        updated += 1;
        continue;
      }
      const { data, error } = await supabase
        .from("asset")
        .insert({
          tenant_id: tenantId,
          custom_id: row.customId,
          ...fields,
        })
        .select("id, custom_id")
        .single();
      if (error || !data) {
        throw new Error(error?.code === "23505" ? "Já existe um ativo com este ID." : "Não foi possível criar o ativo.");
      }
      if (data.custom_id) byCode.set(data.custom_id, data.id);
      created += 1;
    } catch (error) {
      errors.push({
        line: row.line,
        message: error instanceof Error ? error.message : "Não foi possível importar a linha.",
      });
    }
  }

  if (created || updated || categoriesCreated) revalidatePath("/assets");
  if (locationsCreated) revalidatePath("/locations");
  if (categoriesCreated) revalidatePath("/settings");
  errors.sort((a, b) => a.line - b.line);
  return { created, updated, locationsCreated, categoriesCreated, errors };
}
