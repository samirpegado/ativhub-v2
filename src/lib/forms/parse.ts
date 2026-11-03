import { digitsOnly, emptyToNull, formatAddress } from "@/lib/address/format";
import { BRAZIL_STATES } from "@/lib/address/states";
import { parseBrlAmount } from "@/lib/money/brl";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!UUID_RE.test(text)) {
    throw new Error("Identificador inválido.");
  }
  return text;
}

export function parseIdList(ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Selecione ao menos um registro.");
  }
  if (ids.length > 100) {
    throw new Error("Selecione no máximo 100 registros por vez.");
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const text = String(raw ?? "").trim();
    if (!UUID_RE.test(text)) throw new Error("Identificador inválido.");
    if (seen.has(text)) continue;
    seen.add(text);
    unique.push(text);
  }
  return unique;
}

export function parsePostalCode(value: FormDataEntryValue | null) {
  const digits = digitsOnly(String(value ?? ""));
  if (!digits) return null;
  if (digits.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos.");
  }
  return digits;
}

export function parseState(value: FormDataEntryValue | null) {
  const uf = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!uf) return null;
  if (!BRAZIL_STATES.some((item) => item.uf === uf)) {
    throw new Error("UF inválida.");
  }
  return uf;
}

export function parseMoney(value: FormDataEntryValue | null) {
  return parseBrlAmount(value);
}

export function parseDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("Data inválida.");
  }
  return text;
}

export function mutationError(error: { message?: string; code?: string }) {
  const message = error.message ?? "";
  if (message.includes("parent_id cannot equal id")) {
    return "O registro pai não pode ser ele mesmo.";
  }
  if (error.code === "23503") {
    return "Registro relacionado inválido.";
  }
  if (error.code === "23505") {
    return "Já existe um registro com este código.";
  }
  return "Não foi possível salvar. Tente novamente.";
}

export function deleteError(error: { message?: string; code?: string }) {
  if (error.code === "23503") {
    return "Não é possível excluir: há registros vinculados.";
  }
  return "Não foi possível excluir. Tente novamente.";
}

export function addressFromForm(formData: FormData) {
  const postalCode = parsePostalCode(formData.get("postal_code"));
  const street = emptyToNull(formData.get("street"));
  const number = emptyToNull(formData.get("address_number"));
  const complement = emptyToNull(formData.get("complement"));
  const neighborhood = emptyToNull(formData.get("neighborhood"));
  const city = emptyToNull(formData.get("city"));
  const state = parseState(formData.get("state"));

  return {
    postal_code: postalCode,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    address: formatAddress({
      postalCode,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
    }) || null,
  };
}

export function relationName(
  value: { name: string } | { name: string }[] | null | undefined,
) {
  if (!value) return null;
  return Array.isArray(value) ? (value[0]?.name ?? null) : value.name;
}
