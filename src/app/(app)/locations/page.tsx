import type { Metadata } from "next";
import { TenantActivity } from "@/components/layout/tenant-activity";
import { LocationsView } from "@/components/locations/locations-view";
import { requireArea } from "@/lib/auth/permissions";
import { listCustomerChoices, listLocations } from "@/lib/locations/queries";

export const metadata: Metadata = {
  title: "Localizações",
};

export default async function LocationsPage() {
  const { appUser } = await requireArea("locations", "view", { redirect: true });
  const [locations, customers] = await Promise.all([listLocations(), listCustomerChoices()]);
  return (
    <TenantActivity user={appUser}>
      <LocationsView locations={locations} customers={customers} />
    </TenantActivity>
  );
}
