import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartiesView } from "@/components/parties/parties-view";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { parsePartyQuery, partyHref, partyPageCount } from "@/lib/parties/list-params";
import { listVendorsScreen } from "@/lib/parties/queries";

export const metadata: Metadata = {
  title: "Fornecedores",
};

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const query = parsePartyQuery(await searchParams);
  const { appUser } = await requireArea("parties", "view", { redirect: true });
  const screen = await listVendorsScreen(query);
  const pageCount = partyPageCount(screen.total);
  if (query.page > pageCount) redirect(partyHref("vendors", { ...query, page: pageCount }));

  return (
    <PartiesView
      section="vendors"
      query={query}
      canEdit={can(appUser, "parties", "edit")}
      vendors={screen.items}
      total={screen.total}
      totalAll={screen.totalAll}
    />
  );
}
