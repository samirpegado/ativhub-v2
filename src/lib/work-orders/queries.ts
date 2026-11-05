import { requireTenant } from "@/lib/auth/current-user";
import { listChecklists, type ChecklistRecord } from "@/lib/checklists/queries";
import { type LocationOption } from "@/lib/locations/queries";
import { listPeople, listTeams, type PersonRecord, type TeamRecord } from "@/lib/people/queries";
import { generateDuePreventiveWorkOrders } from "@/lib/preventive/queries";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { WorkOrderListQuery } from "@/lib/work-orders/list-params";
import { readWorkOrderDetail, readWorkOrdersScreen, type WorkOrderRecord } from "@/lib/work-orders/payload";

export type {
  CategoryOption,
  WorkOrderCalendarItem,
  WorkOrderDetail,
  WorkOrderPerson,
  WorkOrderRecord,
  WorkOrdersScreen,
} from "@/lib/work-orders/payload";

export async function listWorkOrderCategories() {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase
    .from("category")
    .select("id, name")
    .eq("type", "WORK_ORDER")
    .order("name");

  if (error) throw new Error("Não foi possível carregar as categorias.");
  return data ?? [];
}

export async function listWorkOrdersScreen(query: WorkOrderListQuery) {
  const { supabase } = await requireTenant();
  await generateDuePreventiveWorkOrders();
  const { data, error } = await supabase.rpc("work_orders_screen", {
    p_search: query.search || undefined,
    p_statuses: query.statuses,
    p_priorities: query.priorities,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
    p_include_calendar: query.calendar,
    p_location_ids: query.locationIds.length > 0 ? query.locationIds : undefined,
    p_types: query.types.length > 0 ? query.types : undefined,
    p_overdue: query.overdue,
    p_due_from: query.dueFrom ?? undefined,
    p_due_to: query.dueTo ?? undefined,
  });

  if (error) throw new Error("Não foi possível carregar as ordens de serviço.");
  const screen = await readWorkOrdersScreen(supabase, data);
  const { data: links, error: linkError } = await supabase.from("location").select("id, customer_id");
  if (linkError) throw new Error("Não foi possível carregar as localizações.");
  const customersByLocation = new Map((links ?? []).map((row) => [row.id, row.customer_id]));
  return {
    ...screen,
    locations: screen.locations.map((location) => ({
      ...location,
      customer_id: customersByLocation.get(location.id) ?? null,
    })),
  };
}

export type WorkOrderEditorData = {
  order: WorkOrderRecord;
  locations: LocationOption[];
  assets: { id: string; name: string; custom_id: string | null; location_id: string | null }[];
  people: PersonRecord[];
  teams: TeamRecord[];
  checklists: ChecklistRecord[];
  customers: { id: string; name: string; email: string | null }[];
};

export async function loadWorkOrderEditor(workOrderId: string): Promise<WorkOrderEditorData> {
  const { supabase } = await requireTenant();
  const [detail, locations, assets, people, teams, checklists, customers] = await Promise.all([
    loadWorkOrderDetail(workOrderId),
    supabase.from("location").select("id, name, custom_id, customer_id").order("name"),
    supabase.from("asset").select("id, name, custom_id, location_id").eq("archived", false).order("name"),
    listPeople(),
    listTeams(),
    listChecklists(),
    supabase.from("customer").select("id, name, email").order("name"),
  ]);
  if (locations.error || assets.error || customers.error) {
    throw new Error("Não foi possível abrir a ordem criada.");
  }
  return {
    order: detail.order,
    locations: (locations.data ?? []).flatMap((row) =>
      row.name ? [{ id: row.id, name: row.name, custom_id: row.custom_id, customer_id: row.customer_id }] : [],
    ),
    assets: assets.data ?? [],
    people: people.people,
    teams,
    checklists,
    customers: (customers.data ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name, email: row.email }] : [])),
  };
}

export async function loadWorkOrderDetail(workOrderId: string) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("work_order_detail", {
    p_work_order_id: workOrderId,
  });

  if (error) throw new Error("Não foi possível carregar os detalhes da ordem.");
  return readWorkOrderDetail(supabase, data);
}
