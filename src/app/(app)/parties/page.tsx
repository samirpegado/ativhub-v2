import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartiesView } from "@/components/parties/parties-view";
import { requireArea } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/areas";
import { parsePartyQuery, partyHref, partyPageCount } from "@/lib/parties/list-params";
import { listCustomersScreen, listVendorsScreen } from "@/lib/parties/queries";

export const metadata: Metadata = {
  title: "Fornecedores e contratantes",
};

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  const query = parsePartyQuery(await searchParams);
  const { appUser } = await requireArea("parties", "view", { redirect: true });
  if (query.customers) {
    const screen = await listCustomersScreen(query);
    const pageCount = partyPageCount(screen.total);
    if (query.page > pageCount) redirect(partyHref({ ...query, page: pageCount }));
    return (
      <PartiesView
        query={query}
        canEdit={can(appUser, "parties", "edit")}
        customers={screen.items}
        total={screen.total}
        totalAll={screen.totalAll}
      />
    );
  }

  const screen = await listVendorsScreen(query);
  const pageCount = partyPageCount(screen.total);
  if (query.page > pageCount) redirect(partyHref({ ...query, page: pageCount }));
  return (
    <PartiesView
      query={query}
      canEdit={can(appUser, "parties", "edit")}
      vendors={screen.items}
      total={screen.total}
      totalAll={screen.totalAll}
    />
  );
}
