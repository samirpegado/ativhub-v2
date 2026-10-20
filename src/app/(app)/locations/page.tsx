import { LocationsView } from "@/components/locations/locations-view";
import { listLocations } from "@/lib/locations/queries";

export default async function LocationsPage() {
  const locations = await listLocations();
  return <LocationsView locations={locations} />;
}
