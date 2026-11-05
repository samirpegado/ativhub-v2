import { requireArea } from "@/lib/auth/permissions";
import {
  isWorkOrderPriority,
  isWorkOrderStatus,
  isWorkOrderType,
} from "@/lib/work-orders/status";

export type DashboardFilters = {
  from: string | null;
  to: string | null;
  workerId: string | null;
  locationId: string | null;
  type: string | null;
  status: string | null;
  priority: string | null;
  situation: "overdue" | "on_time" | null;
};

export type DashboardAgendaItem = {
  id: string;
  customId: string | null;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate: string | null;
  locationName: string | null;
  assetName: string | null;
  workers: string;
};

export type DashboardExecuting = {
  id: string;
  customId: string | null;
  title: string;
  startedAt: string | null;
  worker: string;
};

export type WorkOrderDashboard = {
  total: number;
  closed: number;
  remaining: number;
  executing: DashboardExecuting[];
  agenda: DashboardAgendaItem[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function count(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function parseDashboardFilters(
  input: Record<string, string | undefined>,
): DashboardFilters {
  const from = input.d_from && DATE.test(input.d_from) ? input.d_from : null;
  const to = input.d_to && DATE.test(input.d_to) ? input.d_to : null;
  const situation = input.d_situation === "overdue" || input.d_situation === "on_time" ? input.d_situation : null;
  return {
    from: from && to && from > to ? to : from,
    to: from && to && from > to ? from : to,
    workerId: text(input.d_worker),
    locationId: text(input.d_location),
    type: input.d_type && isWorkOrderType(input.d_type) ? input.d_type : null,
    status: input.d_status && isWorkOrderStatus(input.d_status) ? input.d_status : null,
    priority: input.d_priority && isWorkOrderPriority(input.d_priority) ? input.d_priority : null,
    situation,
  };
}

export async function loadWorkOrderDashboard(
  filters: DashboardFilters,
  mine: boolean,
): Promise<WorkOrderDashboard> {
  const { supabase, appUser } = await requireArea("work_orders", "view");
  const membership = mine ? appUser.membershipId : filters.workerId;
  const { data, error } = await supabase.rpc("work_orders_dashboard", {
    p_from: filters.from ?? undefined,
    p_to: filters.to ?? undefined,
    p_membership: membership ?? undefined,
    p_location: filters.locationId ?? undefined,
    p_type: filters.type ?? undefined,
    p_status: filters.status ?? undefined,
    p_priority: filters.priority ?? undefined,
    p_situation: filters.situation ?? undefined,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Não foi possível carregar o painel.");
  }
  const row = data as Record<string, unknown>;
  return {
    total: count(row.total),
    closed: count(row.closed),
    remaining: count(row.remaining),
    executing: readList(row.executing).flatMap((item) => {
      const id = text(item.id);
      const title = text(item.title);
      if (!id || !title) return [];
      return [
        {
          id,
          customId: text(item.customId),
          title,
          startedAt: text(item.startedAt),
          worker: text(item.worker) ?? "Usuário",
        },
      ];
    }),
    agenda: readList(row.agenda).flatMap((item) => {
      const id = text(item.id);
      const title = text(item.title);
      if (!id || !title) return [];
      return [
        {
          id,
          customId: text(item.customId),
          title,
          status: text(item.status) ?? "OPEN",
          priority: text(item.priority) ?? "NONE",
          type: text(item.type) ?? "CORRECTIVE",
          dueDate: text(item.dueDate),
          locationName: text(item.locationName),
          assetName: text(item.assetName),
          workers: text(item.workers) ?? "",
        },
      ];
    }),
  };
}

function readList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    return [item as Record<string, unknown>];
  });
}
