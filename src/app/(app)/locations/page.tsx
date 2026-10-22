import type { Metadata } from "next";
import { LocationsView } from "@/components/locations/locations-view";
import { requireArea } from "@/lib/auth/permissions";
import { listLocations } from "@/lib/locations/queries";

export const metadata: Metadata = {
  title: "Localizações",
};

export default async function LocationsPage() {
  await requireArea("locations", "view", { redirect: true });
  const locations = await listLocations();
  return <LocationsView locations={locations} />;
}
