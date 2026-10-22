import { requireTenant } from "@/lib/auth/current-user";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { PreventiveListQuery } from "@/lib/preventive/list-params";
import { readPreventiveDetail, readPreventiveScreen } from "@/lib/preventive/payload";

export type {
  PreventiveAsset,
  PreventiveDetail,
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
  const { data, error } = await supabase.rpc("preventive_screen", {
    p_search: query.search || undefined,
    p_priority: query.priority ?? undefined,
    p_limit: LIST_PAGE_SIZE,
    p_offset: query.offset,
  });
  if (error) throw new Error("Não foi possível carregar os agendamentos.");
  return readPreventiveScreen(data);
}

export async function loadPreventiveDetail(scheduleId: string) {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.rpc("preventive_detail", { p_id: scheduleId });
  if (error) throw new Error("Não foi possível carregar o agendamento.");
  return readPreventiveDetail(data);
}

export async function generateDuePreventiveWorkOrders() {
  const { supabase } = await requireTenant();
  await generateDue(supabase);
}
