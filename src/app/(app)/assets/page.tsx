import type { Metadata } from "next";
import { AssetsView } from "@/components/assets/assets-view";
import { requireTenant } from "@/lib/auth/current-user";
import { listAssets } from "@/lib/assets/queries";
import { listLocations } from "@/lib/locations/queries";

export const metadata: Metadata = {
  title: "Ativos",
};

export default async function AssetsPage() {
  const [{ tenantId }, assets, locations] = await Promise.all([
    requireTenant(),
    listAssets(),
    listLocations(),
  ]);

  return (
    <AssetsView assets={assets} locations={locations} tenantId={tenantId} />
  );
}
