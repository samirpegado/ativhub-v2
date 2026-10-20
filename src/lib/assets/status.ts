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
