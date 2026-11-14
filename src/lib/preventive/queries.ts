import { requireTenant } from "@/lib/auth/current-user";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { PREVENTIVE_PAGE_SIZE } from "@/lib/preventive/asset-page";
import type { PreventiveListQuery } from "@/lib/preventive/list-params";
import {
  readPreventiveDetail,
  readPreventiveScreen,
  type PreventiveLinkedAsset,
  type PreventiveWorkOrder,
} from "@/lib/preventive/payload";

export type {
  PreventiveAsset,
  PreventiveDetail,
  PreventiveLinkedAsset,
  PreventivePerson,
  PreventiveRecord,
  PreventiveScreen,
  PreventiveTeam,
  PreventiveWorkOrder,
} from "@/lib/preventive/payload";

async function generateDue(supabase: Awaited<ReturnType<typeof requireTenant>>["supabase"]) {
  const { error } = await supabase.rpc("generate_due_preventive_work_orders");
  if (error) throw new Error("Não foi possível gerar as ordens da preventiva.");
}

export async function listPreventiveScreen(query: PreventiveListQuery) {
  const { supabase } = await requireTenant();
  await generateDue(supabase);
  const [{ data, error }, locations, customers] = await Promise.all([
    supabase.rpc("preventive_screen", {
      p_search: query.search || undefined,
      p_priority: query.priority ?? undefined,
      p_limit: LIST_PAGE_SIZE,
      p_offset: query.offset,
    }),
    supabase.from("location").select("id, customer_id"),
    supabase.from("customer").select("id, name").order("name"),
  ]);
  if (error || locations.error || customers.error) {
    throw new Error("Não foi possível carregar os agendamentos.");
  }
  const screen = readPreventiveScreen(data);
  const names = await assigneeNamesBySchedule(supabase, screen.items.map((item) => item.id));
  const customersByLocation = new Map((locations.data ?? []).map((row) => [row.id, row.customer_id]));
  return {
    ...screen,
    items: screen.items.map((item) => ({ ...item, assigneeNames: names.get(item.id) ?? item.assigneeNames })),
    locations: screen.locations.map((location) => ({
      ...location,
      customer_id: customersByLocation.get(location.id) ?? null,
    })),
    customers: (customers.data ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : [])),
  };
}

export async function loadPreventiveDetail(
  scheduleId: string,
  pages: { assets?: number; orders?: number } = {},
) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("preventive_detail", { p_id: scheduleId });
  if (error) throw new Error("Não foi possível carregar o agendamento.");
  const detail = readPreventiveDetail(data);
  const names = await assigneeNamesBySchedule(supabase, [scheduleId]);
  const [assets, workOrders] = await Promise.all([
    linkedAssets(supabase, detail.schedule.assetIds, pages.assets ?? 1),
    generatedOrders(supabase, scheduleId, pages.orders ?? 1),
  ]);
  return {
    ...detail,
    schedule: { ...detail.schedule, assigneeNames: names.get(scheduleId) ?? detail.schedule.assigneeNames },
    assets: assets.items,
    assetTotal: assets.total,
    workOrders: workOrders.items,
    workOrderTotal: workOrders.total,
  };
}

async function assigneeNamesBySchedule(
  supabase: Awaited<ReturnType<typeof requireTenant>>["supabase"],
  scheduleIds: string[],
) {
  const names = new Map<string, string>();
  if (scheduleIds.length === 0) return names;
  const { data: links } = await supabase.from("pm_assignee").select("pm_id, membership_id").in("pm_id", scheduleIds);
  const rows = links ?? [];
  const memberIds = [...new Set(rows.map((row) => row.membership_id))];
  if (memberIds.length === 0) return names;
  const { data: people } = await supabase.from("membership").select("id, first_name, last_name").in("id", memberIds);
  const personName = new Map(
    (people ?? []).map((person) => [person.id, [person.first_name, person.last_name].filter(Boolean).join(" ")]),
  );
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const name = personName.get(row.membership_id);
    if (!name) continue;
    grouped.set(row.pm_id, [...(grouped.get(row.pm_id) ?? []), name]);
  }
  for (const [id, list] of grouped) {
    names.set(id, list.sort((left, right) => left.localeCompare(right, "pt-BR")).join(", "));
  }
  return names;
}

async function generatedOrders(
  supabase: Awaited<ReturnType<typeof requireTenant>>["supabase"],
  scheduleId: string,
  page: number,
): Promise<{ items: PreventiveWorkOrder[]; total: number }> {
  const from = (Math.max(1, page) - 1) * PREVENTIVE_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("work_order")
    .select("id, custom_id, title, status, due_date, created_at", { count: "exact" })
    .eq("parent_pm_id", scheduleId)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .range(from, from + PREVENTIVE_PAGE_SIZE - 1);
  if (error) return { items: [], total: 0 };
  return {
    total: count ?? 0,
    items: (data ?? []).flatMap((row) => {
      if (!row.title) return [];
      return [{
        id: row.id,
        customId: row.custom_id,
        title: row.title,
        status: row.status,
        dueDate: row.due_date,
        createdAt: row.created_at,
      }];
    }),
  };
}

async function linkedAssets(
  supabase: Awaited<ReturnType<typeof requireTenant>>["supabase"],
  assetIds: string[],
  page: number,
): Promise<{ items: PreventiveLinkedAsset[]; total: number }> {
  if (assetIds.length === 0) return { items: [], total: 0 };
  const from = (Math.max(1, page) - 1) * PREVENTIVE_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("asset")
    .select("id, name, custom_id, location:location_id(name, custom_id, customer_id)", { count: "exact" })
    .in("id", assetIds)
    .order("name")
    .range(from, from + PREVENTIVE_PAGE_SIZE - 1);
  if (error) return { items: [], total: 0 };
  const rows = data ?? [];
  const customerIds = [...new Set(rows.flatMap((row) => {
    const location = one(row.location);
    return location?.customer_id ? [location.customer_id] : [];
  }))];
  const customers = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: people } = await supabase.from("customer").select("id, name").in("id", customerIds);
    for (const customer of people ?? []) {
      if (customer.name) customers.set(customer.id, customer.name);
    }
  }
  return {
    total: count ?? 0,
    items: rows.flatMap((row) => {
      if (!row.name) return [];
      const location = one(row.location);
      return [{
        id: row.id,
        name: row.name,
        customId: row.custom_id,
        locationName: location?.name ? (location.custom_id ? `${location.custom_id} · ${location.name}` : location.name) : null,
        customerName: location?.customer_id ? (customers.get(location.customer_id) ?? null) : null,
      }];
    }),
  };
}

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function generateDuePreventiveWorkOrders() {
  const { supabase } = await requireTenant();
  await generateDue(supabase);
}
