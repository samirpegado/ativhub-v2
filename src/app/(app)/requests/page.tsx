import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RequestsView } from "@/components/requests/requests-view";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { parseRequestQuery, requestHref, requestPageCount } from "@/lib/requests/list-params";
import { listRequestsScreen } from "@/lib/requests/queries";

export const metadata: Metadata = {
  title: "Solicitações",
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const query = parseRequestQuery(await searchParams);
  const { supabase, appUser } = await requireArea("requests", "view", { redirect: true });
  const screen = await listRequestsScreen(query);
  const { data: assets } = await supabase.from("asset").select("id, name").order("name");
  const pageCount = requestPageCount(screen.total);
  if (query.page > pageCount) redirect(requestHref({ ...query, page: pageCount }));

  return (
    <RequestsView
      query={query}
      canEdit={can(appUser, "requests", "edit")}
      isAdmin={appUser.isAdmin}
      assets={(assets ?? []).flatMap((asset) => (asset.name ? [{ id: asset.id, name: asset.name }] : []))}
      items={screen.items}
      total={screen.total}
      totalAll={screen.totalAll}
    />
  );
}
