import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkOrderDashboardView } from "@/components/work-orders/work-order-dashboard";
import { WorkOrdersView } from "@/components/work-orders/work-orders-view";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { loadWorkOrderDashboard, parseDashboardFilters } from "@/lib/work-orders/dashboard";
import {
  parseWorkOrderListQuery,
  workOrderListHref,
  workOrderPageCount,
} from "@/lib/work-orders/list-params";
import { listWorkOrdersScreen } from "@/lib/work-orders/queries";

export const metadata: Metadata = {
  title: "Ordens de serviço",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    location?: string;
    type?: string;
    overdue?: string;
    from?: string;
    to?: string;
    page?: string;
    view?: string;
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

  if (!canEdit) {
    const filters = parseDashboardFilters(params);
    const dashboard = await loadWorkOrderDashboard(filters, true);
    const { data: locationRows } = await supabase.from("location").select("id, name").order("name");
    return (
      <WorkOrderDashboardView
        filters={filters}
        dashboard={dashboard}
        locations={(locationRows ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : []))}
        workers={[]}
        canManage={false}
        tenantId={tenantId}
      />
    );
  }

  const query = parseWorkOrderListQuery(params);
  const screen = await listWorkOrdersScreen(query);
  const pageCount = workOrderPageCount(screen.total);
  if (query.page > pageCount) {
    redirect(workOrderListHref({ ...query, page: pageCount }));
  }

  return (
    <WorkOrdersView
      query={query}
      orders={screen.orders}
      total={screen.total}
      totalAll={screen.totalAll}
      calendar={screen.calendar}
      locations={screen.locations}
      assets={screen.assets}
      people={screen.people}
      teams={screen.teams}
      checklists={screen.checklists}
      customers={screen.customers}
      canEdit={canEdit}
      tenantId={tenantId}
    />
  );
}
