import type { Metadata } from "next";
import { AssetsView } from "@/components/assets/assets-view";
import { requireArea } from "@/lib/auth/permissions";
import { listAssets } from "@/lib/assets/queries";
import { listLocations } from "@/lib/locations/queries";

export const metadata: Metadata = {
  title: "Ativos",
};

export default async function AssetsPage() {
  const { tenantId } = await requireArea("assets", "view", { redirect: true });
  const [assets, locations] = await Promise.all([listAssets(), listLocations()]);

  return (
    <AssetsView assets={assets} locations={locations} tenantId={tenantId} />
  );
}
