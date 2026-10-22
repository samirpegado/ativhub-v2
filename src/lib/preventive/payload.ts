import type { ChecklistRecord } from "@/lib/checklists/queries";
import type { LocationOption } from "@/lib/locations/queries";
import { isTaskType, type WorkOrderTask } from "@/lib/work-orders/tasks";

export type PreventiveTask = WorkOrderTask;

export type PreventiveRecord = {
  id: string;
  customId: string | null;
  name: string;
  title: string;
  description: string | null;
  priority: string;
  frequency: number;
  recurrenceType: string;
  recurrenceBasedOn: string;
  daysOfWeek: number[];
  startsOn: string;
  endsOn: string | null;
  dueDateDelay: number | null;
  estimatedDuration: number | null;
  disabled: boolean;
  nextRunAt: string | null;
  locationId: string | null;
  locationName: string | null;
  assetId: string | null;
  assetName: string | null;
  teamId: string | null;
  teamName: string | null;
  primaryUserId: string | null;
  primaryUserName: string | null;
  tasks: PreventiveTask[];
};

export type PreventiveAsset = {
  id: string;
  name: string;
  custom_id: string | null;
  location_id: string | null;
};

export type PreventivePerson = {
  id: string;
  firstName: string;
  lastName: string;
};

export type PreventiveTeam = { id: string; name: string };

export type PreventiveWorkOrder = {
  id: string;
  customId: string | null;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

export type PreventiveScreen = {
  items: PreventiveRecord[];
  total: number;
  totalAll: number;
  locations: LocationOption[];
  assets: PreventiveAsset[];
  people: PreventivePerson[];
  teams: PreventiveTeam[];
  checklists: ChecklistRecord[];
};

export type PreventiveDetail = {
  schedule: PreventiveRecord;
  workOrders: PreventiveWorkOrder[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function amount(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function daysOf(value: unknown) {
  return asList(value)
    .map((item) => Number(item))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function tasksOf(value: unknown): PreventiveTask[] {
  return asList(value).flatMap((item) => {
    const row = asRecord(item);
    const label = text(row?.label);
    const taskType = text(row?.taskType);
    if (!row || !label || !taskType) return [];
    const options = asList(row.options).filter((option): option is string => typeof option === "string");
    return [
      {
        label,
        taskType: isTaskType(taskType) ? taskType : "SUBTASK",
        options,
      },
    ];
  });
}

function mapSchedule(value: unknown): PreventiveRecord | null {
  const row = asRecord(value);
  const id = text(row?.id);
  const name = text(row?.name);
  const title = text(row?.title);
  const startsOn = text(row?.startsOn);
  if (!row || !id || !name || !title || !startsOn) return null;
  return {
    id,
    customId: text(row.customId),
    name,
    title,
    description: text(row.description),
    priority: text(row.priority) ?? "NONE",
    frequency: amount(row.frequency) ?? 1,
    recurrenceType: text(row.recurrenceType) ?? "DAILY",
    recurrenceBasedOn: text(row.recurrenceBasedOn) ?? "SCHEDULED_DATE",
    daysOfWeek: daysOf(row.daysOfWeek),
    startsOn,
    endsOn: text(row.endsOn),
    dueDateDelay: amount(row.dueDateDelay),
    estimatedDuration: amount(row.estimatedDuration),
    disabled: row.disabled === true,
    nextRunAt: text(row.nextRunAt),
    locationId: text(row.locationId),
    locationName: text(row.locationName),
    assetId: text(row.assetId),
    assetName: text(row.assetName),
    teamId: text(row.teamId),
    teamName: text(row.teamName),
    primaryUserId: text(row.primaryUserId),
    primaryUserName: text(row.primaryUserName),
    tasks: tasksOf(row.tasks),
  };
}

export function readPreventiveScreen(data: unknown): PreventiveScreen {
  const screen = asRecord(data);
  if (!screen) throw new Error("Não foi possível carregar os agendamentos.");
  const total = amount(screen.total) ?? 0;
  return {
    items: asList(screen.items).flatMap((item) => {
      const schedule = mapSchedule(item);
      return schedule ? [schedule] : [];
    }),
    total,
    totalAll: amount(screen.totalAll) ?? 0,
    locations: asList(screen.locations).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const name = text(row?.name);
      if (!row || !id || !name) return [];
      return [{ id, name, custom_id: text(row.customId) }];
    }),
    assets: asList(screen.assets).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const name = text(row?.name);
      if (!row || !id || !name) return [];
      return [{ id, name, custom_id: text(row.customId), location_id: text(row.locationId) }];
    }),
    people: asList(screen.people).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      if (!row || !id) return [];
      return [{ id, firstName: text(row.firstName) ?? "", lastName: text(row.lastName) ?? "" }];
    }),
    teams: asList(screen.teams).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const name = text(row?.name);
      if (!row || !id || !name) return [];
      return [{ id, name }];
    }),
    checklists: asList(screen.checklists).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const name = text(row?.name);
      if (!row || !id || !name) return [];
      return [{ id, name, tasks: tasksOf(row.tasks) }];
    }),
  };
}

export function readPreventiveDetail(data: unknown): PreventiveDetail {
  const detail = asRecord(data);
  const schedule = mapSchedule(detail?.schedule);
  if (!schedule) throw new Error("Não foi possível carregar o agendamento.");
  return {
    schedule,
    workOrders: asList(detail?.workOrders).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const title = text(row?.title);
      const createdAt = text(row?.createdAt);
      if (!row || !id || !title || !createdAt) return [];
      return [
        {
          id,
          customId: text(row.customId),
          title,
          status: text(row.status) ?? "OPEN",
          dueDate: text(row.dueDate),
          createdAt,
        },
      ];
    }),
  };
}
