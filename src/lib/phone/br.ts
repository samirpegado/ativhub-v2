export function phoneDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 11);
}

export function formatPhone(value: string | null | undefined) {
  const digits = phoneDigits(value);
  if (!digits) return "";

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length <= 2) return `(${ddd}`;
  if (digits.length <= 6) return `(${ddd}) ${rest}`;
  if (digits.length <= 10) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
