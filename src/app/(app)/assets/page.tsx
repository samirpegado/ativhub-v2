import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AssetsView } from "@/components/assets/assets-view";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { assetListHref, assetPageCount, parseAssetListQuery } from "@/lib/assets/list-params";
import { listAssetsScreen } from "@/lib/assets/queries";
import { listAssetCategories } from "@/lib/categories/queries";
import { listLocations } from "@/lib/locations/queries";

export const metadata: Metadata = {
  title: "Ativos",
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; location?: string; page?: string }>;
}) {
  const query = parseAssetListQuery(await searchParams);
  const { tenantId, appUser } = await requireArea("assets", "view", { redirect: true });
  const [screen, locations, categories] = await Promise.all([
    listAssetsScreen(query),
    listLocations(),
    listAssetCategories(),
  ]);
  const pageCount = assetPageCount(screen.total);
  if (query.page > pageCount) redirect(assetListHref({ ...query, page: pageCount }));

  return (
    <AssetsView
      query={query}
      assets={screen.items}
      total={screen.total}
      totalAll={screen.totalAll}
      locations={locations}
      categories={categories}
      canManageCategories={appUser.isAdmin}
      canEdit={can(appUser, "assets", "edit")}
      tenantId={tenantId}
    />
  );
}
