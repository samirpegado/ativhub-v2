import { requireTenant } from "@/lib/auth/current-user";
import { listChecklists } from "@/lib/checklists/queries";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { listPeople, listTeams } from "@/lib/people/queries";
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
  const customersByLocation = new Map((locations.data ?? []).map((row) => [row.id, row.customer_id]));
  return {
    ...screen,
    locations: screen.locations.map((location) => ({
      ...location,
      customer_id: customersByLocation.get(location.id) ?? null,
    })),
    customers: (customers.data ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : [])),
  };
}

export async function loadPreventiveEditor() {
  const { supabase } = await requireTenant();
  const [locations, assets, people, teams, checklists, customers] = await Promise.all([
    supabase.from("location").select("id, name, custom_id, customer_id").order("name"),
    supabase.from("asset").select("id, name, custom_id, location_id").eq("archived", false).order("name"),
    listPeople(),
    listTeams(),
    listChecklists(),
    supabase.from("customer").select("id, name").order("name"),
  ]);
  if (locations.error || assets.error || customers.error) {
    throw new Error("Não foi possível carregar o formulário do agendamento.");
  }
  return {
    locations: (locations.data ?? []).flatMap((row) =>
      row.name ? [{ id: row.id, name: row.name, custom_id: row.custom_id, customer_id: row.customer_id }] : [],
    ),
    assets: (assets.data ?? []).flatMap((row) =>
      row.name ? [{ id: row.id, name: row.name, custom_id: row.custom_id, location_id: row.location_id }] : [],
    ),
    people: people.people.map((person) => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
    })),
    teams: teams.map((team) => ({ id: team.id, name: team.name })),
    checklists,
    customers: (customers.data ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : [])),
  };
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
