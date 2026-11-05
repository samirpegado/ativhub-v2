import type { Metadata } from "next";
import { WorkOrderDashboardView } from "@/components/work-orders/work-order-dashboard";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { loadWorkOrderDashboard, parseDashboardFilters } from "@/lib/work-orders/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    d_from?: string;
    d_to?: string;
    d_worker?: string;
    d_location?: string;
    d_type?: string;
    d_status?: string;
    d_priority?: string;
    d_situation?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, tenantId, appUser } = await requireArea("work_orders", "view", { redirect: true });
  const canEdit = can(appUser, "work_orders", "edit");
  const filters = parseDashboardFilters(params);
  const dashboard = await loadWorkOrderDashboard(filters, !canEdit);
  const [{ data: locationRows }, { data: workerRows }] = await Promise.all([
    supabase.from("location").select("id, name").order("name"),
    canEdit
      ? supabase.from("membership").select("id, first_name, last_name").eq("enabled", true).order("first_name")
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
  ]);

  return (
    <WorkOrderDashboardView
      filters={filters}
      dashboard={dashboard}
      locations={(locationRows ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : []))}
      workers={(workerRows ?? []).map((row) => ({
        id: row.id,
        name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Usuário",
      }))}
      canManage={canEdit}
      tenantId={tenantId}
    />
  );
}
