import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { platformListHref } from "@/components/platform-admin/list-href";
import { PlatformList } from "@/components/platform-admin/platform-list";
import { TenantsTable } from "@/components/platform-admin/tenant-tables";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";
import { getPlatformListParams, loadPlatformTenants } from "@/lib/platform-admin/queries";

export const metadata: Metadata = { title: "Empresas" };

export default async function PlatformTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const query = getPlatformListParams(await searchParams);
  const { total, rows } = await loadPlatformTenants(query);
  const lastPage = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (query.page > lastPage) redirect(platformListHref(PLATFORM_TENANTS_PATH, { ...query, page: lastPage }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
      <PlatformList path={PLATFORM_TENANTS_PATH} query={query} total={total} searchLabel="Buscar empresa" emptyLabel="Nenhuma empresa cadastrada.">
        <TenantsTable rows={rows} />
      </PlatformList>
    </div>
  );
}
