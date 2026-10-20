const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBrl(amount: number) {
  return brl.format(amount);
}

export function formatBrlFromDigits(digits: string) {
  const only = digits.replace(/\D/g, "").slice(0, 15);
  if (!only) return "";
  return brl.format(Number(only) / 100);
}

export function formatBrlInput(value: number | string | null | undefined) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? brl.format(value) : "";
  }
  return formatBrlFromDigits(value);
}

export function parseBrlAmount(value: FormDataEntryValue | string | null) {
  const raw = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/[\s\u00a0]/g, "")
    .trim();
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Valor inválido.");
  }
  return Math.round(amount * 100) / 100;
}
