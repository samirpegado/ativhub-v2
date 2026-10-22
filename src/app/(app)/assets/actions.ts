"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { emptyToNull } from "@/lib/address/format";
import { ASSET_STATUSES } from "@/lib/assets/status";
import {
  deleteError,
  mutationError,
  parseDate,
  parseMoney,
  parseUuid,
} from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";

function readAssetFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Informe o nome do ativo.");
  }

  const locationId = parseUuid(formData.get("location_id"));
  if (!locationId) {
    throw new Error("Selecione a localização do ativo.");
  }

  const status = String(formData.get("status") ?? "OPERATIONAL");
  if (!ASSET_STATUSES.some((item) => item.value === status)) {
    throw new Error("Status inválido.");
  }

  return {
    name,
    location_id: locationId,
    status,
    description: emptyToNull(formData.get("description")),
    model: emptyToNull(formData.get("model")),
    manufacturer: emptyToNull(formData.get("manufacturer")),
    serial_number: emptyToNull(formData.get("serial_number")),
    bar_code: emptyToNull(formData.get("bar_code")),
    power: emptyToNull(formData.get("power")),
    area: emptyToNull(formData.get("area")),
    acquisition_cost: parseMoney(formData.get("acquisition_cost")),
    in_service_date: parseDate(formData.get("in_service_date")),
    warranty_expiration_date: parseDate(
      formData.get("warranty_expiration_date"),
    ),
    additional_infos: emptyToNull(formData.get("additional_infos")),
  };
}

const IMAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

function readImageUrl(formData: FormData, tenantId: string) {
  if (!formData.has("image_path")) return undefined;

  const raw = String(formData.get("image_path") ?? "").trim();
  if (!raw) return null;

  const prefix = `${tenantId}/assets/`;
  const fileName = raw.startsWith(prefix) ? raw.slice(prefix.length) : "";
  if (!IMAGE_PATH.test(fileName) || raw.includes("..")) {
    throw new Error("Imagem inválida.");
  }

  return raw;
}

export async function createAsset(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("assets", "edit");

  try {
    const fields = readAssetFields(formData);
    const { error } = await supabase.from("asset").insert({
      tenant_id: tenantId,
      ...fields,
      image_url: readImageUrl(formData, tenantId) ?? null,
    });
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar o ativo.",
    };
  }

  revalidatePath("/assets");
  return { success: true } as const;
}

export async function updateAsset(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("assets", "edit");

  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Ativo inválido.");
    const imageUrl = readImageUrl(formData, tenantId);
    const fields = {
      ...readAssetFields(formData),
      ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
    };
    const { error } = await supabase.from("asset").update(fields).eq("id", id);
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o ativo.",
    };
  }

  revalidatePath("/assets");
  return { success: true } as const;
}

export async function deleteAsset(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("assets", "edit");

  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Ativo inválido.");
    const { error } = await supabase.from("asset").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o ativo.",
    };
  }

  revalidatePath("/assets");
}
