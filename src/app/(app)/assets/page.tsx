import type { Metadata } from "next";
import { AssetsView } from "@/components/assets/assets-view";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { listAssets } from "@/lib/assets/queries";
import { listAssetCategories } from "@/lib/categories/queries";
import { listLocations } from "@/lib/locations/queries";

export const metadata: Metadata = {
  title: "Ativos",
};

export default async function AssetsPage() {
  const { tenantId, appUser } = await requireArea("assets", "view", { redirect: true });
  const [assets, locations, categories] = await Promise.all([
    listAssets(),
    listLocations(),
    listAssetCategories(),
  ]);

  return (
    <AssetsView
      assets={assets}
      locations={locations}
      categories={categories}
      canManageCategories={appUser.isAdmin}
      canEdit={can(appUser, "assets", "edit")}
      tenantId={tenantId}
    />
  );
}
