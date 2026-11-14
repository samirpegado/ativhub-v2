import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PreventiveDetailView } from "@/components/preventive/preventive-detail";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { parsePreventiveDetailQuery, preventiveDetailHref, preventivePageCount } from "@/lib/preventive/asset-page";
import { loadPreventiveDetail } from "@/lib/preventive/queries";

export const metadata: Metadata = {
  title: "Preventiva",
};

export default async function PreventiveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; ordens?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const pages = parsePreventiveDetailQuery(await searchParams);
  const { appUser } = await requireArea("preventive", "view", { redirect: true });
  const canEdit = can(appUser, "preventive", "edit");
  const detail = await loadPreventiveDetail(id, pages).catch(() => null);
  if (!detail) notFound();
  const assetPages = preventivePageCount(detail.assetTotal);
  const orderPages = preventivePageCount(detail.workOrderTotal);
  if (pages.assets > assetPages || pages.orders > orderPages) {
    redirect(preventiveDetailHref(id, {
      assets: Math.min(pages.assets, assetPages),
      orders: Math.min(pages.orders, orderPages),
    }));
  }

  return (
    <PreventiveDetailView
      schedule={detail.schedule}
      assets={detail.assets}
      assetTotal={detail.assetTotal}
      assetPage={pages.assets}
      workOrders={detail.workOrders}
      workOrderTotal={detail.workOrderTotal}
      workOrderPage={pages.orders}
      canEdit={canEdit}
    />
  );
}
