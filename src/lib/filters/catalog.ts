import { revalidatePath } from "next/cache";
import { listAssetCategories } from "@/lib/categories/queries";
import { listLocations } from "@/lib/locations/queries";

export type CatalogOption = {
  id: string;
  name: string;
  customerName?: string | null;
};

export type FilterCatalog = {
  categories: CatalogOption[];
  locations: CatalogOption[];
};

export function revalidateFilterCatalog() {
  revalidatePath("/", "layout");
}

export async function loadFilterCatalog(): Promise<FilterCatalog> {
  const [categories, locations] = await Promise.all([
    listAssetCategories().catch(() => []),
    listLocations().catch(() => []),
  ]);
  return {
    categories: categories.map((category) => ({ id: category.id, name: category.name })),
    locations: locations.map((location) => ({
      id: location.id,
      name: location.custom_id ? `${location.custom_id} · ${location.name}` : location.name,
      customerName: location.customer_name,
    })),
  };
}
