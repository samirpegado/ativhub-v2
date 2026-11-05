export const ASSET_STATUSES = [
  { value: "OPERATIONAL", label: "Operacional" },
  { value: "MODERNIZATION", label: "Modernização" },
  { value: "STANDBY", label: "Em espera" },
  { value: "INSPECTION_SCHEDULED", label: "Inspeção agendada" },
  { value: "COMMISSIONING", label: "Comissionamento" },
  { value: "DOWN", label: "Fora de serviço" },
  { value: "EMERGENCY_SHUTDOWN", label: "Desligamento de emergência" },
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number]["value"];

export function assetStatusLabel(status: string) {
  return ASSET_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function assetStatusClass(status: string) {
  if (status === "OPERATIONAL") return "bg-emerald-500/15 text-emerald-700";
  if (status === "DOWN" || status === "EMERGENCY_SHUTDOWN") return "bg-destructive/10 text-destructive";
  if (status === "STANDBY" || status === "INSPECTION_SCHEDULED") return "bg-amber-500/15 text-amber-800";
  if (status === "MODERNIZATION" || status === "COMMISSIONING") return "bg-sky-500/15 text-sky-800";
  return "bg-muted text-muted-foreground";
}

export function assetStatusColor(status: string) {
  if (status === "OPERATIONAL") return "#10b981";
  if (status === "DOWN" || status === "EMERGENCY_SHUTDOWN") return "#FF1943";
  if (status === "STANDBY" || status === "INSPECTION_SCHEDULED") return "#f59e0b";
  if (status === "MODERNIZATION" || status === "COMMISSIONING") return "#0ea5e9";
  return "#6E759F";
}
