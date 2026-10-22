import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import type { LocationOption } from "@/lib/locations/queries";
import type { PersonRecord, TeamRecord } from "@/lib/people/queries";
import type { Database } from "@/lib/supabase/database.types";
import { signStoragePaths } from "@/lib/storage/signed-url";
import type {
  WorkOrderActivity,
  WorkOrderPartLine,
  WorkOrderPartOption,
} from "@/lib/work-orders/activity";
import { isTaskType, type WorkOrderTask } from "@/lib/work-orders/tasks";

export type WorkOrderPerson = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type WorkOrderRecord = {
  id: string;
  customId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedStartDate: string | null;
  estimatedDuration: number | null;
  requiredSignature: boolean;
  locationId: string | null;
  locationName: string | null;
  assetId: string | null;
  assetName: string | null;
  teamId: string | null;
  primaryUserId: string | null;
  primaryUserName: string | null;
  primaryUser: WorkOrderPerson | null;
  assignees: WorkOrderPerson[];
  categoryId: string | null;
  billingMode: "NONE" | "HOURLY" | "FIXED";
  serviceAmount: number | null;
  assigneeIds: string[];
  tasks: WorkOrderTask[];
  firstTimeToReact: string | null;
};

export type CategoryOption = { id: string; name: string };

type ScreenAsset = {
  id: string;
  name: string;
  custom_id: string | null;
  location_id: string | null;
};

export type WorkOrderCalendarItem = {
  id: string;
  customId: string | null;
  title: string;
  status: string;
  dueDate: string | null;
  estimatedStartDate: string | null;
  estimatedDuration: number | null;
};

export type WorkOrdersScreen = {
  orders: WorkOrderRecord[];
  total: number;
  totalAll: number;
  calendar: WorkOrderCalendarItem[];
  locations: LocationOption[];
  assets: ScreenAsset[];
  people: PersonRecord[];
  teams: TeamRecord[];
  categories: CategoryOption[];
  checklists: ChecklistRecord[];
};

export type WorkOrderDetail = {
  order: WorkOrderRecord;
  activity: WorkOrderActivity;
  logoUrl: string | null;
};

type Client = SupabaseClient<Database>;

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

function stringList(value: unknown) {
  return asList(value).filter((item): item is string => typeof item === "string");
}

function portrait(value: unknown) {
  const row = asRecord(value);
  const id = text(row?.id);
  if (!row || !id) return null;
  return {
    id,
    firstName: text(row.firstName) ?? "",
    lastName: text(row.lastName) ?? "",
    imagePath: text(row.imagePath),
  };
}

function portraitName(person: { firstName: string; lastName: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function imagePathsFromOrder(row: Record<string, unknown> | null) {
  const primary = portrait(row?.primaryUser);
  const assignees = asList(row?.assignees).map(portrait);
  return [primary, ...assignees]
    .map((person) => person?.imagePath)
    .filter((path): path is string => Boolean(path));
}

function mapOrder(
  row: Record<string, unknown>,
  imageUrls: Map<string, string | null>,
): WorkOrderRecord {
  function toPerson(value: unknown): WorkOrderPerson | null {
    const person = portrait(value);
    if (!person) return null;
    return {
      id: person.id,
      name: portraitName(person) || "Usuário",
      imageUrl: person.imagePath ? (imageUrls.get(person.imagePath) ?? null) : null,
    };
  }

  const primary = toPerson(row.primaryUser);
  const assignees = asList(row.assignees)
    .map(toPerson)
    .filter((person): person is WorkOrderPerson => Boolean(person));

  return {
    id: text(row.id) ?? "",
    customId: text(row.customId),
    title: text(row.title) ?? "",
    description: text(row.description),
    status: text(row.status) ?? "OPEN",
    priority: text(row.priority) ?? "NONE",
    dueDate: text(row.dueDate),
    estimatedStartDate: text(row.estimatedStartDate),
    estimatedDuration: typeof row.estimatedDuration === "number" ? row.estimatedDuration : null,
    requiredSignature: row.requiredSignature === true,
    locationId: text(row.locationId),
    locationName: text(row.locationName),
    assetId: text(row.assetId),
    assetName: text(row.assetName),
    teamId: text(row.teamId),
    primaryUserId: text(row.primaryUserId),
    primaryUserName: primary?.name ?? null,
    primaryUser: primary,
    categoryId: text(row.categoryId),
    billingMode:
      row.billingMode === "HOURLY" || row.billingMode === "FIXED" ? row.billingMode : "NONE",
    serviceAmount: typeof row.serviceAmount === "number" ? row.serviceAmount : null,
    firstTimeToReact: text(row.firstTimeToReact),
    assigneeIds: assignees.map((person) => person.id),
    assignees,
    tasks: asList(row.tasks).flatMap((item) => {
      const task = asRecord(item);
      const label = text(task?.label);
      const taskType = text(task?.taskType);
      if (!task || !label || !taskType) return [];
      return [
        {
          id: text(task.id) ?? undefined,
          label,
          taskType: isTaskType(taskType) ? taskType : "SUBTASK",
          options: stringList(task.options),
          value: text(task.value),
        },
      ];
    }),
  };
}

function countOf(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? count : 0;
}

function amount(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapPartOption(value: unknown): WorkOrderPartOption | null {
  const row = asRecord(value);
  const id = text(row?.id);
  const name = text(row?.name);
  if (!row || !id || !name) return null;
  return {
    id,
    name,
    unit: text(row.unit),
    cost: amount(row.cost),
    quantity: amount(row.quantity),
    nonStock: row.nonStock === true,
  };
}

function mapPartLine(value: unknown): WorkOrderPartLine | null {
  const row = asRecord(value);
  const option = mapPartOption(row);
  const id = text(row?.id);
  const partId = text(row?.partId);
  if (!row || !option || !id || !partId) return null;
  return { ...option, id, partId };
}

export async function readWorkOrdersScreen(supabase: Client, data: unknown): Promise<WorkOrdersScreen> {
  const screen = asRecord(data);
  if (!screen) throw new Error("Não foi possível carregar as ordens de serviço.");

  const orderRows = asList(screen.orders).map((item) => asRecord(item));
  const imagePaths = [...new Set(orderRows.flatMap((row) => imagePathsFromOrder(row)))];
  const signed = await signStoragePaths(supabase, imagePaths);
  const imageUrls = new Map(imagePaths.map((path, index) => [path, signed[index] ?? null]));
  const orders = orderRows
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => mapOrder(row, imageUrls));

  return {
    orders,
    total: countOf(screen.total),
    totalAll: countOf(screen.totalAll),
    calendar: asList(screen.calendar).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const title = text(row?.title);
      if (!row || !id || !title) return [];
      return [
        {
          id,
          customId: text(row.customId),
          title,
          status: text(row.status) ?? "OPEN",
          dueDate: text(row.dueDate),
          estimatedStartDate: text(row.estimatedStartDate),
          estimatedDuration:
            typeof row.estimatedDuration === "number" ? row.estimatedDuration : null,
        } satisfies WorkOrderCalendarItem,
      ];
    }),
    locations: asList(screen.locations).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const id = text(row.id);
      const name = text(row.name);
      if (!id || !name) return [];
      return [{ id, name, custom_id: text(row.customId) } satisfies LocationOption];
    }),
    assets: asList(screen.assets).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const id = text(row.id);
      const name = text(row.name);
      if (!id || !name) return [];
      return [
        {
          id,
          name,
          custom_id: text(row.customId),
          location_id: text(row.locationId),
        } satisfies ScreenAsset,
      ];
    }),
    people: asList(screen.people).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const id = text(row.id);
      const roleId = text(row.roleId);
      if (!id || !roleId) return [];
      return [
        {
          id,
          firstName: text(row.firstName) ?? "",
          lastName: text(row.lastName) ?? "",
          email: text(row.email) ?? "",
          phone: text(row.phone),
          roleId,
          roleCode: text(row.roleCode) ?? "",
          roleName: text(row.roleName) ?? "Usuário",
          roleDescription: text(row.roleDescription) ?? "",
          isOwner: row.isOwner === true,
        } satisfies PersonRecord,
      ];
    }),
    teams: asList(screen.teams).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const id = text(row.id);
      const name = text(row.name);
      if (!id || !name) return [];
      return [
        {
          id,
          name,
          description: text(row.description),
          memberIds: stringList(row.memberIds),
        } satisfies TeamRecord,
      ];
    }),
    categories: asList(screen.categories).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const id = text(row.id);
      const name = text(row.name);
      if (!id || !name) return [];
      return [{ id, name } satisfies CategoryOption];
    }),
    checklists: asList(screen.checklists).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const id = text(row.id);
      const name = text(row.name);
      if (!id || !name) return [];
      return [
        {
          id,
          name,
          tasks: asList(row.tasks).flatMap((taskItem) => {
            const task = asRecord(taskItem);
            const label = text(task?.label);
            const taskType = text(task?.taskType);
            if (!task || !label || !taskType) return [];
            return [
              {
                label,
                taskType: isTaskType(taskType) ? taskType : "SUBTASK",
                options: stringList(task.options),
              },
            ];
          }),
        } satisfies ChecklistRecord,
      ];
    }),
  };
}

export async function readWorkOrderDetail(supabase: Client, data: unknown): Promise<WorkOrderDetail> {
  const detail = asRecord(data);
  const orderRow = asRecord(detail?.order);
  if (!detail || !orderRow) throw new Error("Não foi possível carregar os detalhes da ordem.");

  const fileRows = asList(detail.files).map((item) => asRecord(item));
  const logoPath = text(detail.logoPath);
  const imagePaths = [
    ...new Set([
      ...imagePathsFromOrder(orderRow),
      ...fileRows.map((file) => text(file?.path)).filter((path): path is string => Boolean(path)),
      ...(logoPath ? [logoPath] : []),
    ]),
  ];
  const signed = await signStoragePaths(supabase, imagePaths);
  const urls = new Map(imagePaths.map((path, index) => [path, signed[index] ?? null]));
  const timer = asRecord(detail.timer);

  return {
    order: mapOrder(orderRow, urls),
    activity: {
      timer: timer
        ? {
            durationSeconds: typeof timer.durationSeconds === "number" ? timer.durationSeconds : 0,
            startedAt: text(timer.startedAt),
            hourlyRate: typeof timer.hourlyRate === "number" ? timer.hourlyRate : null,
          }
        : null,
      labors: asList(detail.labors).flatMap((item) => {
        const row = asRecord(item);
        const id = text(row?.id);
        if (!row || !id) return [];
        return [
          {
            id,
            durationSeconds: typeof row.durationSeconds === "number" ? row.durationSeconds : 0,
            workedOn: text(row.workedOn),
            hourlyRate: typeof row.hourlyRate === "number" ? row.hourlyRate : null,
            author: text(row.author) ?? "Usuário",
          },
        ];
      }),
      files: fileRows.flatMap((row) => {
        const id = text(row?.id);
        const path = text(row?.path);
        if (!row || !id || !path) return [];
        return [{ id, name: text(row.name) ?? "Arquivo", url: urls.get(path) ?? "" }];
      }),
      updates: asList(detail.updates).flatMap((item) => {
        const row = asRecord(item);
        const id = text(row?.id);
        const createdAt = text(row?.createdAt);
        if (!row || !id || !createdAt) return [];
        return [
          {
            id,
            body: text(row.body) ?? "",
            createdAt,
            author: text(row.author) ?? "Usuário",
          },
        ];
      }),
      parts: asList(detail.parts).flatMap((item) => {
        const line = mapPartLine(item);
        return line ? [line] : [];
      }),
      partOptions: asList(detail.partOptions).flatMap((item) => {
        const option = mapPartOption(item);
        return option ? [option] : [];
      }),
    },
    logoUrl: logoPath ? (urls.get(logoPath) ?? null) : null,
  };
}
