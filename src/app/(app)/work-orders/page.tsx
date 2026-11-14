import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkOrdersView } from "@/components/work-orders/work-orders-view";
import { loadAssetPickerHit } from "@/lib/assets/picker";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import {
  parseWorkOrderListQuery,
  workOrderListHref,
  workOrderPageCount,
} from "@/lib/work-orders/list-params";
import { listWorkOrdersScreen } from "@/lib/work-orders/queries";

export const metadata: Metadata = {
  title: "Ordens de serviço",
};

export default async function WorkOrdersPage({
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
    asset?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, appUser } = await requireArea("work_orders", "view", { redirect: true });
  const query = parseWorkOrderListQuery(params);
  const screen = await listWorkOrdersScreen(query);
  const pageCount = workOrderPageCount(screen.total);
  if (query.page > pageCount) {
    redirect(workOrderListHref({ ...query, page: pageCount }));
  }
  const presetAssetId = /^[0-9a-f-]{36}$/i.test(params.asset ?? "") ? params.asset : null;
  const lockedAsset = presetAssetId ? await loadAssetPickerHit(supabase, presetAssetId) : null;

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
      canEdit={can(appUser, "work_orders", "edit")}
      presetAssetId={presetAssetId}
      lockedAsset={lockedAsset}
    />
  );
}
