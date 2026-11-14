import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InventoryView } from "@/components/inventory/inventory-view";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import {
  inventoryHref,
  inventoryPageCount,
  parseInventoryQuery,
} from "@/lib/inventory/list-params";
import { listPartSetsScreen, listPartsScreen } from "@/lib/inventory/queries";

export const metadata: Metadata = {
  title: "Peças e inventário",
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stock?: string; page?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const query = parseInventoryQuery(params);
  const { appUser } = await requireArea("inventory", "view", { redirect: true });
  const canEdit = can(appUser, "inventory", "edit");

  if (query.sets) {
    const screen = await listPartSetsScreen(query);
    const pageCount = inventoryPageCount(screen.total);
    if (query.page > pageCount) {
      redirect(inventoryHref({ ...query, page: pageCount }));
    }
    return (
      <InventoryView
        query={query}
        canEdit={canEdit}
        sets={screen.sets}
        setTotal={screen.total}
        setTotalAll={screen.totalAll}
        partOptions={screen.parts}
      />
    );
  }

  const screen = await listPartsScreen(query);
  const pageCount = inventoryPageCount(screen.total);
  if (query.page > pageCount) {
    redirect(inventoryHref({ ...query, page: pageCount }));
  }

  return (
    <InventoryView
      query={query}
      canEdit={canEdit}
      parts={screen.parts}
      total={screen.total}
      totalAll={screen.totalAll}
    />
  );
}
