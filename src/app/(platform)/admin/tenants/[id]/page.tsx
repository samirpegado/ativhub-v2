import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listTdClass, listTdNameClass } from "@/components/lists/table-classes";
import { platformListHref } from "@/components/platform-admin/list-href";
import { PlatformList } from "@/components/platform-admin/platform-list";
import { SupportPreviewButton } from "@/components/platform-admin/support-preview-button";
import { PlatformDate, PlatformTable, TenantMetrics } from "@/components/platform-admin/tenant-tables";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";
import { getPlatformListParams, loadPlatformPeople } from "@/lib/platform-admin/queries";
import { canStartSupportPreview } from "@/lib/platform-admin/support";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Detalhes da empresa" };

const peopleColumns = [
  { label: "Pessoa" },
  { label: "Papel" },
  { label: "Situação" },
  { label: "Último acesso ao tenant (Brasília)" },
  { label: "Último login (Brasília)" },
];

export default async function PlatformTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const query = getPlatformListParams(search);
  const [detail, canPreview] = await Promise.all([
    loadPlatformPeople({ tenantId: id, ...query }),
    canStartSupportPreview(),
  ]);
  if (!detail) notFound();

  const { tenant, total } = detail;
  const path = `${PLATFORM_TENANTS_PATH}/${tenant.id}`;
  const lastPage = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (query.page > lastPage) redirect(platformListHref(path, { ...query, page: lastPage }));

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link href={PLATFORM_TENANTS_PATH} prefetch={false} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          Voltar para empresas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight wrap-break-word">{tenant.name}</h1>
        <p className="text-sm text-muted-foreground">Cadastro em <PlatformDate value={tenant.createdAt} /></p>
      </header>
      <TenantMetrics tenant={tenant} />
      <section aria-labelledby="tenant-people-title" className="space-y-3">
        <h2 id="tenant-people-title" className="text-lg font-semibold">Pessoas</h2>
        <PlatformList
          path={path}
          query={query}
          total={total}
          searchLabel="Buscar pessoa"
          emptyLabel="Nenhuma pessoa cadastrada."
        >
          <PlatformTable label="Pessoas da empresa" columns={canPreview ? [...peopleColumns, { label: "Suporte" }] : peopleColumns}>
            {detail.rows.map((person) => (
              <tr key={person.id}>
                <th scope="row" className={cn(listTdNameClass, "min-w-44")}>
                  <div>{[person.firstName, person.lastName].filter(Boolean).join(" ") || "Sem nome"}</div>
                  {person.email ? <div className="wrap-anywhere text-xs font-normal text-muted-foreground">{person.email}</div> : null}
                </th>
                <td className={listTdClass}>{person.roleName || "—"}</td>
                <td className={listTdClass}>{person.enabled ? "Habilitada" : "Desabilitada"}</td>
                <td className={cn(listTdClass, "whitespace-nowrap")}>
                  {person.lastAccessAt ? <PlatformDate value={person.lastAccessAt} withTime /> : "Sem acesso registrado"}
                </td>
                <td className={cn(listTdClass, "whitespace-nowrap")}>
                  {person.lastSignInAt ? <PlatformDate value={person.lastSignInAt} withTime /> : "Sem login registrado"}
                </td>
                {canPreview ? (
                  <td className={listTdClass}>
                    {person.enabled ? (
                      <SupportPreviewButton
                        tenantId={tenant.id}
                        membershipId={person.id}
                        personName={[person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "Pessoa"}
                      />
                    ) : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </PlatformTable>
        </PlatformList>
      </section>
    </div>
  );
}
