"use server";

import { revalidatePath } from "next/cache";
import { assetsToCsv, readAssetCsv, type AssetCsvRow } from "@/lib/assets/csv";
import { ASSET_CATEGORY_TYPE } from "@/lib/categories/queries";
import { requireArea } from "@/lib/auth/permissions";
import { relationName } from "@/lib/forms/parse";

export type AssetImportResult = {
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
};

const MAX_ROWS = 500;

function matchOne(
  items: { id: string; name: string }[],
  name: string,
  missing: string,
  many: string,
) {
  const found = items.filter((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (found.length === 0) throw new Error(missing);
  if (found.length > 1) throw new Error(many);
  return found[0].id;
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

function columns(row: AssetCsvRow, locationId: string, categoryId: string | null) {
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
    return { created: 0, updated: 0, errors: [{ line: 1, message: "O arquivo é grande demais." }] };
  }
  const parsed = readAssetCsv(csv);
  if (parsed.rows.length + parsed.errors.length > MAX_ROWS) {
    return {
      created: 0,
      updated: 0,
      errors: [{ line: 1, message: `Importe no máximo ${MAX_ROWS} linhas por vez.` }],
    };
  }
  if (parsed.errors.some((item) => item.line === 1)) {
    return { created: 0, updated: 0, errors: parsed.errors };
  }

  const [locations, categories, assets] = await Promise.all([
    supabase.from("location").select("id, name"),
    supabase.from("category").select("id, name").eq("type", ASSET_CATEGORY_TYPE),
    supabase.from("asset").select("id, custom_id"),
  ]);
  if (locations.error || categories.error || assets.error) {
    return { created: 0, updated: 0, errors: [{ line: 1, message: "Não foi possível ler os cadastros." }] };
  }

  const byCode = new Map<string, string>();
  for (const asset of assets.data ?? []) {
    if (asset.custom_id) byCode.set(asset.custom_id, asset.id);
  }

  let created = 0;
  let updated = 0;
  const errors = [...parsed.errors];

  for (const row of parsed.rows) {
    try {
      const locationId = matchOne(
        locations.data ?? [],
        row.locationName,
        "Localização não encontrada.",
        "Há mais de uma localização com este nome.",
      );
      const categoryId = row.categoryName
        ? matchOne(
            categories.data ?? [],
            row.categoryName,
            "Categoria não encontrada.",
            "Há mais de uma categoria com este nome.",
          )
        : null;
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

  if (created || updated) revalidatePath("/assets");
  errors.sort((a, b) => a.line - b.line);
  return { created, updated, errors };
}
