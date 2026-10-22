export const RECURRENCE_BASES = [
  { value: "SCHEDULED_DATE", label: "Data agendada" },
  { value: "COMPLETED_DATE", label: "Conclusão da ordem" },
] as const;

export const RECURRENCE_TYPES = [
  { value: "DAILY", label: "Dias" },
  { value: "WEEKLY", label: "Semanas" },
  { value: "MONTHLY", label: "Meses" },
  { value: "YEARLY", label: "Anos" },
] as const;

export const WEEKDAYS = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
] as const;

export type RecurrenceBase = (typeof RECURRENCE_BASES)[number]["value"];
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number]["value"];

export function isRecurrenceBase(value: string): value is RecurrenceBase {
  return RECURRENCE_BASES.some((item) => item.value === value);
}

export function isRecurrenceType(value: string): value is RecurrenceType {
  return RECURRENCE_TYPES.some((item) => item.value === value);
}

export function recurrenceBaseLabel(value: string) {
  return RECURRENCE_BASES.find((item) => item.value === value)?.label ?? value;
}

export function scheduleDescription(input: {
  frequency: number;
  recurrenceType: string;
  recurrenceBasedOn: string;
  daysOfWeek: number[];
}) {
  const days =
    input.recurrenceType === "WEEKLY" && input.recurrenceBasedOn === "SCHEDULED_DATE"
      ? input.daysOfWeek
          .slice()
          .sort((left, right) => left - right)
          .map((day) => WEEKDAYS[day])
          .filter(Boolean)
          .join(", ")
      : "";
  const count = input.frequency;
  if (input.recurrenceType === "DAILY") {
    return count === 1 ? "Todo dia" : `A cada ${count} dias`;
  }
  if (input.recurrenceType === "WEEKLY") {
    const base = count === 1 ? "Toda semana" : `A cada ${count} semanas`;
    return days ? `${base}, ${days}` : base;
  }
  if (input.recurrenceType === "MONTHLY") {
    return count === 1 ? "Todo mês" : `A cada ${count} meses`;
  }
  if (input.recurrenceType === "YEARLY") {
    return count === 1 ? "Todo ano" : `A cada ${count} anos`;
  }
  return "";
}

export function formatScheduleDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function nextRunLabel(input: {
  disabled: boolean;
  nextRunAt: string | null;
  recurrenceBasedOn: string;
}) {
  if (input.disabled) return "Pausado";
  if (!input.nextRunAt) {
    return input.recurrenceBasedOn === "COMPLETED_DATE" ? "Após concluir a ordem" : "Encerrado";
  }
  return formatScheduleDate(input.nextRunAt);
}
