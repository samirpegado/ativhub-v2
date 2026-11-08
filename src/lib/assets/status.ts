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
  if (status === "MODERNIZATION") return "bg-blue-600/15 text-blue-700";
  if (status === "STANDBY") return "bg-amber-500/15 text-amber-800";
  if (status === "INSPECTION_SCHEDULED") return "bg-purple-500/15 text-purple-700";
  if (status === "COMMISSIONING") return "bg-teal-500/15 text-teal-700";
  if (status === "DOWN") return "bg-destructive/10 text-destructive";
  if (status === "EMERGENCY_SHUTDOWN") return "bg-pink-600/15 text-pink-700";
  return "bg-muted text-muted-foreground";
}

export function assetStatusColor(status: string) {
  if (status === "OPERATIONAL") return "#10b981";
  if (status === "MODERNIZATION") return "#2563eb";
  if (status === "STANDBY") return "#f59e0b";
  if (status === "INSPECTION_SCHEDULED") return "#a855f7";
  if (status === "COMMISSIONING") return "#14b8a6";
  if (status === "DOWN") return "#FF1943";
  if (status === "EMERGENCY_SHUTDOWN") return "#db2777";
  return "#6E759F";
}
