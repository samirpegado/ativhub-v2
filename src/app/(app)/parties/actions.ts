"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { emptyToNull } from "@/lib/address/format";
import { readCompanySettings } from "@/lib/company/profile";
import { deleteError, mutationError, parseUuid } from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import { formatPhone, phoneDigits } from "@/lib/phone/br";
import { formatTaxId, isValidTaxId, taxDigits } from "@/lib/tax-id/br";

function refresh() {
  revalidatePath("/customers");
  revalidatePath("/vendors");
  revalidatePath("/locations");
}

function readPin(value: FormDataEntryValue | null, required: boolean) {
  const pin = String(value ?? "").trim();
  if (!pin) {
    if (required) throw new Error("Informe o PIN de 4 dígitos.");
    return null;
  }
  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN deve ter 4 dígitos.");
  return pin;
}

function readPhone(value: FormDataEntryValue | null) {
  const raw = emptyToNull(value);
  if (!raw) return null;
  if (phoneDigits(raw).length < 10) throw new Error("Telefone inválido.");
  return formatPhone(raw);
}

function readEmail(value: FormDataEntryValue | null) {
  const email = emptyToNull(value);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("E-mail inválido.");
  }
  return email;
}

function readVendor(formData: FormData) {
  const companyName = String(formData.get("company_name") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!companyName) throw new Error("Informe a empresa.");
  if (!name) throw new Error("Informe o contato.");
  return {
    company_name: companyName,
    name,
    phone: readPhone(formData.get("phone")),
    email: readEmail(formData.get("email")),
    website: emptyToNull(formData.get("website")),
    vendor_type: emptyToNull(formData.get("vendor_type")),
    description: emptyToNull(formData.get("description")),
  };
}

function readTaxId(value: FormDataEntryValue | null) {
  const raw = emptyToNull(value);
  if (!raw) return null;
  const digits = taxDigits(raw);
  if (!isValidTaxId(digits)) throw new Error("Informe um CPF ou CNPJ válido.");
  return formatTaxId(digits);
}

function customerSaveError(error: { message?: string; code?: string }) {
  if (error.code === "23505" && (error.message ?? "").includes("tax_id")) {
    return "Já existe um cliente com este CPF ou CNPJ.";
  }
  return mutationError(error);
}

function readCustomer(formData: FormData, editing: boolean) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Informe o nome.");
  const pin = readPin(formData.get("request_pin"), editing);
  return {
    name,
    tax_id: readTaxId(formData.get("tax_id")),
    phone: readPhone(formData.get("phone")),
    email: readEmail(formData.get("email")),
    website: emptyToNull(formData.get("website")),
    customer_type: emptyToNull(formData.get("customer_type")),
    description: emptyToNull(formData.get("description")),
    ...(pin ? { request_pin: pin } : {}),
  };
}

export async function createVendor(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("parties", "edit");
  try {
    const { error } = await supabase.from("vendor").insert({ tenant_id: tenantId, ...readVendor(formData) });
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o fornecedor." };
  }
  refresh();
  return { success: true };
}

export async function updateVendor(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("parties", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Fornecedor inválido.");
    const { error } = await supabase.from("vendor").update(readVendor(formData)).eq("id", id);
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o fornecedor." };
  }
  refresh();
  return { success: true };
}

export async function deleteVendor(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("parties", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Fornecedor inválido.");
    const { error } = await supabase.from("vendor").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir o fornecedor." };
  }
  refresh();
  return { success: true };
}

export async function createCustomer(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("parties", "edit");
  try {
    const { error } = await supabase.from("customer").insert({ tenant_id: tenantId, ...readCustomer(formData, false) });
    if (error) return { error: customerSaveError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o cliente." };
  }
  refresh();
  return { success: true };
}

export async function updateCustomer(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("parties", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Cliente inválido.");
    const { error } = await supabase.from("customer").update(readCustomer(formData, true)).eq("id", id);
    if (error) return { error: customerSaveError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o cliente." };
  }
  refresh();
  return { success: true };
}

export async function deleteCustomer(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("parties", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Cliente inválido.");
    const { error } = await supabase.from("customer").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir o cliente." };
  }
  refresh();
  return { success: true };
}

export async function adoptInternalCustomer(): Promise<{ error: string } | { id: string }> {
  const { supabase, tenantId } = await requireArea("parties", "edit");
  const { data: tenant, error: tenantError } = await supabase
    .from("tenant")
    .select("name, settings")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError || !tenant) return { error: "Não foi possível ler os dados da empresa." };
  const profile = readCompanySettings(tenant.settings);
  const { data, error } = await supabase
    .from("customer")
    .insert({
      tenant_id: tenantId,
      name: tenant.name.trim() || "Minha empresa",
      phone: profile.phone || null,
      website: profile.website || null,
      tax_id: null,
      is_internal: true,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Já existe um cliente da própria empresa." };
    return { error: mutationError(error) };
  }
  refresh();
  return { id: data.id };
}

export async function linkLocationsToInternal(): Promise<{ error: string } | { success: true }> {
  const { supabase, tenantId } = await requireArea("parties", "edit");
  const { data: customer, error: readError } = await supabase
    .from("customer")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_internal", true)
    .maybeSingle();
  if (readError || !customer) return { error: "Cadastre a própria empresa como cliente antes de vincular." };
  const { error } = await supabase
    .from("location")
    .update({ customer_id: customer.id })
    .eq("tenant_id", tenantId)
    .is("customer_id", null);
  if (error) return { error: "Não foi possível vincular as localizações." };
  refresh();
  return { success: true };
}
