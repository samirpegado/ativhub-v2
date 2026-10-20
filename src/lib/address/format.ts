export type AddressParts = {
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCep(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatAddress(parts: AddressParts) {
  const streetLine = [parts.street?.trim(), parts.number?.trim()]
    .filter(Boolean)
    .join(", ");
  const extra = [parts.complement?.trim(), parts.neighborhood?.trim()]
    .filter(Boolean)
    .join(" — ");
  const cityLine = [parts.city?.trim(), parts.state?.trim()]
    .filter(Boolean)
    .join(" / ");
  const cep = parts.postalCode?.trim()
    ? `CEP ${formatCep(parts.postalCode)}`
    : "";

  return [streetLine, extra, cityLine, cep].filter(Boolean).join(" • ");
}

export function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}
