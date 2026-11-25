import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listTdClass, listTdNameClass } from "@/components/lists/table-classes";
import { platformListHref } from "@/components/platform-admin/list-href";
import { PlatformList } from "@/components/platform-admin/platform-list";
import { PlatformDate, PlatformTable, TenantMetrics } from "@/components/platform-admin/tenant-tables";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";
import { getPlatformListParams, loadPlatformTenant } from "@/lib/platform-admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Detalhes da empresa" };

const tabs = [
  { value: "customers", label: "Clientes" },
  { value: "people", label: "Pessoas" },
] as const;

const customerColumns = [{ label: "Nome" }, { label: "Tipo" }];
const peopleColumns = [{ label: "Pessoa" }, { label: "Papel" }, { label: "Situação" }, { label: "Último login (Brasília)" }];

export default async function PlatformTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; q?: string | string[]; page?: string | string[] }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const query = getPlatformListParams(search);
  const tab = search.tab === "people" ? "people" : "customers";
  const detail = await loadPlatformTenant({ tenantId: id, tab, ...query });
  if (!detail) notFound();

  const { tenant, total } = detail;
  const path = `${PLATFORM_TENANTS_PATH}/${tenant.id}`;
  const lastPage = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (query.page > lastPage) redirect(platformListHref(path, { ...query, tab, page: lastPage }));

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
      <section className="space-y-3">
        <nav aria-label="Dados da empresa" className="flex gap-1 border-b">
          {tabs.map(({ value, label }) => (
            <Link
              key={value}
              href={platformListHref(path, { tab: value })}
              prefetch={false}
              aria-current={value === tab ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
                value === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <PlatformList
          key={tab}
          path={path}
          tab={tab}
          query={query}
          total={total}
          searchLabel={tab === "people" ? "Buscar pessoa" : "Buscar cliente"}
          emptyLabel={tab === "people" ? "Nenhuma pessoa cadastrada." : "Nenhum cliente cadastrado."}
        >
          {detail.tab === "customers" ? (
            <PlatformTable label="Clientes da empresa" columns={customerColumns}>
              {detail.rows.map((customer) => (
                <tr key={customer.id}>
                  <th scope="row" className={listTdNameClass}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {customer.name}
                      {customer.isInternal ? (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">Cliente interno</span>
                      ) : null}
                    </span>
                  </th>
                  <td className={listTdClass}>{customer.customerType || "—"}</td>
                </tr>
              ))}
            </PlatformTable>
          ) : (
            <PlatformTable label="Pessoas da empresa" columns={peopleColumns}>
              {detail.rows.map((person) => (
                <tr key={person.id}>
                  <th scope="row" className={cn(listTdNameClass, "min-w-44")}>
                    <div>{[person.firstName, person.lastName].filter(Boolean).join(" ") || "Sem nome"}</div>
                    {person.email ? <div className="wrap-anywhere text-xs font-normal text-muted-foreground">{person.email}</div> : null}
                  </th>
                  <td className={listTdClass}>{person.roleName || "—"}</td>
                  <td className={listTdClass}>{person.enabled ? "Habilitada" : "Desabilitada"}</td>
                  <td className={cn(listTdClass, "whitespace-nowrap")}>
                    {person.lastSignInAt ? <PlatformDate value={person.lastSignInAt} withTime /> : "Sem login registrado"}
                  </td>
                </tr>
              ))}
            </PlatformTable>
          )}
        </PlatformList>
      </section>
    </div>
  );
}
