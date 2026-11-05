import type { Metadata } from "next";
import { LocationsView } from "@/components/locations/locations-view";
import { requireArea } from "@/lib/auth/permissions";
import { listCustomerChoices, listLocations } from "@/lib/locations/queries";

export const metadata: Metadata = {
  title: "Localizações",
};

export default async function LocationsPage() {
  await requireArea("locations", "view", { redirect: true });
  const [locations, customers] = await Promise.all([listLocations(), listCustomerChoices()]);
  return <LocationsView locations={locations} customers={customers} />;
}
