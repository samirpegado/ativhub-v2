export const WORK_ORDER_STATUSES = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "ON_HOLD", label: "Em espera" },
  { value: "COMPLETE", label: "Concluído" },
] as const;

export const WORK_ORDER_PRIORITIES = [
  { value: "NONE", label: "Nenhuma" },
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]["value"];
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number]["value"];

export function workOrderStatusLabel(status: string) {
  return WORK_ORDER_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function workOrderPriorityLabel(priority: string) {
  return (
    WORK_ORDER_PRIORITIES.find((item) => item.value === priority)?.label ?? priority
  );
}

export function isWorkOrderStatus(value: string): value is WorkOrderStatus {
  return WORK_ORDER_STATUSES.some((item) => item.value === value);
}

export function isWorkOrderPriority(value: string): value is WorkOrderPriority {
  return WORK_ORDER_PRIORITIES.some((item) => item.value === value);
}

export function statusTimestamps(input: {
  next: WorkOrderStatus;
  previousStatus: WorkOrderStatus | null;
  firstTimeToReact: string | null;
  membershipId: string | null;
}) {
  const now = new Date().toISOString();
  const previous = input.previousStatus;
  const patch: {
    first_time_to_react?: string;
    completed_by?: string | null;
    completed_on?: string | null;
  } = {};

  if (
    previous === "OPEN" &&
    input.next !== "OPEN" &&
    input.next !== "ON_HOLD" &&
    !input.firstTimeToReact
  ) {
    patch.first_time_to_react = now;
  }

  if (input.next === "COMPLETE" && previous !== "COMPLETE") {
    patch.completed_by = input.membershipId;
    patch.completed_on = now;
  }

  if (previous === "COMPLETE" && input.next !== "COMPLETE") {
    patch.completed_by = null;
    patch.completed_on = null;
  }

  return patch;
}
