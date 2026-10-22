"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { emptyToNull } from "@/lib/address/format";
import { deleteError, mutationError, parseMoney, parseUuid } from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import { formatPhone, phoneDigits } from "@/lib/phone/br";

function refresh() {
  revalidatePath("/parties");
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
    rate: parseMoney(formData.get("rate")),
  };
}

function readCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Informe o nome.");
  return {
    name,
    phone: readPhone(formData.get("phone")),
    email: readEmail(formData.get("email")),
    website: emptyToNull(formData.get("website")),
    customer_type: emptyToNull(formData.get("customer_type")),
    description: emptyToNull(formData.get("description")),
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
    const { error } = await supabase.from("customer").insert({ tenant_id: tenantId, ...readCustomer(formData) });
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o contratante." };
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
    if (!id) throw new Error("Contratante inválido.");
    const { error } = await supabase.from("customer").update(readCustomer(formData)).eq("id", id);
    if (error) return { error: mutationError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o contratante." };
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
    if (!id) throw new Error("Contratante inválido.");
    const { error } = await supabase.from("customer").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir o contratante." };
  }
  refresh();
  return { success: true };
}
