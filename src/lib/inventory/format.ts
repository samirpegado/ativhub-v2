import { formatBrl } from "@/lib/money/brl";

export function formatQuantity(quantity: number, unit: string | null) {
  const text = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(quantity);
  return unit ? `${text} ${unit}` : text;
}

export function formatPartCost(cost: number, unit: string | null) {
  return unit ? `${formatBrl(cost)} / ${unit}` : formatBrl(cost);
}

export function movementLabel(reason: string | null) {
  if (reason === "ADJUSTMENT") return "Ajuste";
  if (reason === "WO_CONSUME") return "Consumo na ordem";
  if (reason === "WO_RETURN") return "Estorno da ordem";
  return reason || "Movimento";
}

export function isLowStock(part: { quantity: number; minQuantity: number; nonStock: boolean }) {
  return !part.nonStock && part.quantity < part.minQuantity;
}
