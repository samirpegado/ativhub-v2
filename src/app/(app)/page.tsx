import { WorkOrdersView } from "@/components/work-orders/work-orders-view";
import { listChecklists } from "@/lib/checklists/queries";
import { listAssets } from "@/lib/assets/queries";
import { listLocations } from "@/lib/locations/queries";
import { listPeople, listTeams } from "@/lib/people/queries";
import {
  listWorkOrderCategories,
  listWorkOrders,
} from "@/lib/work-orders/queries";

export default async function HomePage() {
  const [orders, locations, assets, peopleResult, teams, categories, checklists] =
    await Promise.all([
      listWorkOrders(),
      listLocations(),
      listAssets(),
      listPeople(),
      listTeams(),
      listWorkOrderCategories(),
      listChecklists(),
    ]);

  return (
    <WorkOrdersView
      orders={orders}
      locations={locations}
      assets={assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        custom_id: asset.custom_id,
        location_id: asset.location_id,
      }))}
      people={peopleResult.people}
      teams={teams}
      categories={categories}
      checklists={checklists}
    />
  );
}
