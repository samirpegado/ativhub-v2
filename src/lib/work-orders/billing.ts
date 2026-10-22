import type { WorkOrderActivity } from "@/lib/work-orders/activity";

export const BILLING_MODES = [
  { value: "NONE", label: "Sem cobrança" },
  { value: "HOURLY", label: "Por hora" },
  { value: "FIXED", label: "Valor fixo" },
] as const;

export type BillingMode = (typeof BILLING_MODES)[number]["value"];

export function isBillingMode(value: string): value is BillingMode {
  return BILLING_MODES.some((item) => item.value === value);
}

export function partsTotal(parts: { cost: number; quantity: number }[]) {
  return parts.reduce((sum, part) => sum + part.cost * part.quantity, 0);
}

export function serviceCharge(
  order: { billingMode: BillingMode; serviceAmount: number | null },
  activity: Pick<WorkOrderActivity, "labors" | "timer">,
) {
  if (order.billingMode === "FIXED") return order.serviceAmount ?? 0;
  if (order.billingMode !== "HOURLY") return 0;
  const manual = activity.labors.reduce(
    (sum, labor) => sum + (labor.durationSeconds / 3600) * (labor.hourlyRate ?? 0),
    0,
  );
  const timer = activity.timer
    ? (activity.timer.durationSeconds / 3600) * (activity.timer.hourlyRate ?? 0)
    : 0;
  return Math.round((manual + timer) * 100) / 100;
}
