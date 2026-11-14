export const REQUEST_KINDS = [
  { value: "SERVICE", label: "Serviço" },
  { value: "PARTS", label: "Peças" },
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number]["value"];

export function isRequestKind(value: string): value is RequestKind {
  return REQUEST_KINDS.some((item) => item.value === value);
}

export function requestKindLabel(kind: string) {
  return REQUEST_KINDS.find((item) => item.value === kind)?.label ?? "Serviço";
}
