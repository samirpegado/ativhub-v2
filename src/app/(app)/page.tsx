import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkOrdersView } from "@/components/work-orders/work-orders-view";
import { requireTenant } from "@/lib/auth/current-user";
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
    page?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const query = parseWorkOrderListQuery(params);
  const [{ tenantId }, screen] = await Promise.all([
    requireTenant(),
    listWorkOrdersScreen(query),
  ]);
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
      categories={screen.categories}
      checklists={screen.checklists}
      tenantId={tenantId}
    />
  );
}
