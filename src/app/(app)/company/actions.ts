"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { addressFromForm } from "@/lib/forms/parse";
import { emptyToNull } from "@/lib/address/format";
import type { MutationState } from "@/lib/forms/state";
import { formatPhone, phoneDigits } from "@/lib/phone/br";

function readPhone(value: FormDataEntryValue | null) {
  const raw = emptyToNull(value);
  if (!raw) return "";
  if (phoneDigits(raw).length < 10) throw new Error("Telefone inválido.");
  return formatPhone(raw);
}

export async function updateCompany(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireAdmin();
  try {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Informe o nome da empresa.");
    if (name.length > 120) throw new Error("O nome deve ter no máximo 120 caracteres.");

    const website = emptyToNull(formData.get("website"));
    if (website && website.length > 200) throw new Error("O site deve ter no máximo 200 caracteres.");

    const pinRaw = String(formData.get("request_pin") ?? "").trim();
    if (pinRaw && !/^\d{4,6}$/.test(pinRaw)) {
      throw new Error("O PIN deve ter de 4 a 6 dígitos.");
    }

    const { data: current, error: readError } = await supabase
      .from("tenant")
      .select("settings, logo_url")
      .eq("id", tenantId)
      .maybeSingle();
    if (readError || !current) return { error: "Não foi possível carregar a empresa." };

    const settings =
      current.settings && typeof current.settings === "object" && !Array.isArray(current.settings)
        ? { ...current.settings }
        : {};
    const address = addressFromForm(formData);
    const nextSettings = {
      ...settings,
      phone: readPhone(formData.get("phone")),
      website: website ?? "",
      address: {
        postalCode: address.postal_code ?? "",
        street: address.street ?? "",
        number: address.number ?? "",
        complement: address.complement ?? "",
        neighborhood: address.neighborhood ?? "",
        city: address.city ?? "",
        state: address.state ?? "",
      },
      ...(pinRaw ? { requestPin: pinRaw } : {}),
    };

    let logoUrl = current.logo_url;
    if (formData.has("image_path")) {
      const path = String(formData.get("image_path") ?? "").trim();
      if (!path) {
        logoUrl = null;
      } else if (path !== `${tenantId}/logo.jpg`) {
        throw new Error("Logo inválido.");
      } else {
        logoUrl = path;
      }
    }

    const { error } = await supabase
      .from("tenant")
      .update({ name, settings: nextSettings, logo_url: logoUrl })
      .eq("id", tenantId);
    if (error) return { error: "Não foi possível salvar a empresa." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar a empresa." };
  }

  revalidatePath("/company");
  revalidatePath("/", "layout");
  return { success: true };
}
