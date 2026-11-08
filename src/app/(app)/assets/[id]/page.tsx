import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AssetDetailView } from "@/components/assets/asset-detail";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { assetDetailHref, assetHistoryPageCount, parseAssetHistoryQuery } from "@/lib/assets/history-params";
import { loadAssetDetail } from "@/lib/assets/queries";
import { listAssetCategories } from "@/lib/categories/queries";
import { listLocations } from "@/lib/locations/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; tipo?: string }>;
};

export const metadata: Metadata = {
  title: "Ativo",
};

export default async function AssetDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const history = parseAssetHistoryQuery(await searchParams);
  const { tenantId, appUser } = await requireArea("assets", "view", { redirect: true });
  const canEdit = can(appUser, "assets", "edit");
  const detail = await loadAssetDetail(id, history).catch(() => null);
  if (!detail) notFound();
  const pageCount = assetHistoryPageCount(detail.history.total);
  if (history.page > pageCount) {
    redirect(assetDetailHref(id, { type: history.type, page: pageCount }));
  }
  const [locations, categories] = canEdit
    ? await Promise.all([listLocations(), listAssetCategories()])
    : [[], []];

  return (
    <AssetDetailView
      detail={detail}
      history={history}
      locations={locations}
      categories={categories}
      canManageCategories={appUser.isAdmin}
      canEdit={canEdit}
      canCreateOrder={can(appUser, "work_orders", "edit")}
      tenantId={tenantId}
    />
  );
}
