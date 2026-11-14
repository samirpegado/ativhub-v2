import { FilterCatalogProvider } from "@/components/filters/filter-catalog";
import { AppShell } from "@/components/layout/app-shell";
import { can } from "@/lib/auth/areas";
import { requireUser } from "@/lib/auth/current-user";
import { loadFilterCatalog } from "@/lib/filters/catalog";
import { countPendingRequests } from "@/lib/requests/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [pendingRequestCount, catalog] = await Promise.all([
    can(user, "requests", "view") ? countPendingRequests() : Promise.resolve(null),
    loadFilterCatalog(),
  ]);

  return (
    <FilterCatalogProvider catalog={catalog}>
      <AppShell user={user} pendingRequestCount={pendingRequestCount}>{children}</AppShell>
    </FilterCatalogProvider>
  );
}
