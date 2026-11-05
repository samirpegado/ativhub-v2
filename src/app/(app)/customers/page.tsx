import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartiesView } from "@/components/parties/parties-view";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { parsePartyQuery, partyHref, partyPageCount } from "@/lib/parties/list-params";
import { listCustomersScreen } from "@/lib/parties/queries";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const query = parsePartyQuery(await searchParams);
  const { supabase, appUser } = await requireArea("parties", "view", { redirect: true });
  const [screen, internal] = await Promise.all([
    listCustomersScreen(query),
    supabase.from("customer").select("id").eq("is_internal", true).limit(1).maybeSingle(),
  ]);
  const pageCount = partyPageCount(screen.total);
  if (query.page > pageCount) redirect(partyHref("customers", { ...query, page: pageCount }));

  return (
    <PartiesView
      section="customers"
      query={query}
      canEdit={can(appUser, "parties", "edit")}
      hasInternal={Boolean(internal.data)}
      customers={screen.items}
      total={screen.total}
      totalAll={screen.totalAll}
    />
  );
}
