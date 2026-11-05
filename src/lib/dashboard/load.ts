import { requireArea } from "@/lib/auth/permissions";
import { readMaintenanceOverview, type TechRange } from "@/lib/dashboard/overview";

export async function loadMaintenanceOverview(membershipId: string | null, range?: TechRange | null) {
  const { supabase } = await requireArea("work_orders", "view");
  const { data, error } = await supabase.rpc("maintenance_overview", {
    p_membership: membershipId ?? undefined,
    p_range: range ?? undefined,
  });
  if (error) throw new Error("Não foi possível carregar o painel.");
  return readMaintenanceOverview(data);
}
