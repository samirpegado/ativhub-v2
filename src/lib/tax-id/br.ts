export function taxDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 14);
}

export function formatTaxId(value: string | null | undefined) {
  const digits = taxDigits(value);
  if (!digits) return "";

  if (digits.length <= 11) {
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 9);
    const part4 = digits.slice(9, 11);
    if (digits.length <= 3) return part1;
    if (digits.length <= 6) return `${part1}.${part2}`;
    if (digits.length <= 9) return `${part1}.${part2}.${part3}`;
    return `${part1}.${part2}.${part3}-${part4}`;
  }

  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);
  if (digits.length <= 8) return `${part1}.${part2}.${part3}`;
  if (digits.length <= 12) return `${part1}.${part2}.${part3}/${part4}`;
  return `${part1}.${part2}.${part3}/${part4}-${part5}`;
}

function sameDigits(digits: string) {
  return /^(\d)\1+$/.test(digits);
}

function cpfCheck(digits: string, length: number) {
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Number(digits[index]) * (length + 1 - index);
  }
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
}

function cnpjCheck(digits: string, length: number) {
  const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Number(digits[index]) * weights[index];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function isValidTaxId(value: string | null | undefined) {
  const digits = taxDigits(value);
  if (sameDigits(digits)) return false;
  if (digits.length === 11) {
    return cpfCheck(digits, 9) === Number(digits[9]) && cpfCheck(digits, 10) === Number(digits[10]);
  }
  if (digits.length === 14) {
    return cnpjCheck(digits, 12) === Number(digits[12]) && cnpjCheck(digits, 13) === Number(digits[13]);
  }
  return false;
}
