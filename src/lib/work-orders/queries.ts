import { requireTenant } from "@/lib/auth/current-user";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { WorkOrderListQuery } from "@/lib/work-orders/list-params";
import { readWorkOrderDetail, readWorkOrdersScreen } from "@/lib/work-orders/payload";

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
  const { data, error } = await supabase.rpc("work_orders_screen", {
    p_search: query.search || undefined,
    p_statuses: query.statuses,
    p_priorities: query.priorities,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
    p_include_calendar: query.calendar,
  });

  if (error) throw new Error("Não foi possível carregar as ordens de serviço.");
  return readWorkOrdersScreen(supabase, data);
}

export async function loadWorkOrderDetail(workOrderId: string) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("work_order_detail", {
    p_work_order_id: workOrderId,
  });

  if (error) throw new Error("Não foi possível carregar os detalhes da ordem.");
  return readWorkOrderDetail(supabase, data);
}
