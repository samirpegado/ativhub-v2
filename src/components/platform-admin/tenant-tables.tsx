import type { ReactNode } from "react";
import Link from "next/link";
import { listTdClass, listTdNameClass, listThClass } from "@/components/lists/table-classes";
import { Card } from "@/components/ui/card";
import { PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";
import type { PlatformTenantSummary } from "@/lib/platform-admin/queries";
import { cn } from "@/lib/utils";

const metrics = [
  { label: "Ativos", key: "assetCount" },
  { label: "OS", key: "workOrderCount" },
  { label: "Clientes", key: "customerCount" },
  { label: "Localizações", key: "locationCount" },
  { label: "Pessoas", key: "peopleCount" },
] as const;

const numberFormat = new Intl.NumberFormat("pt-BR");
const timeZone = "America/Sao_Paulo";
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone,
});

export function PlatformDate({ value, withTime = false }: { value: string; withTime?: boolean }) {
  const format = withTime ? dateTimeFormat : dateFormat;
  return <time dateTime={value}>{format.format(new Date(value))}</time>;
}

export function PlatformTable({
  label,
  columns,
  children,
}: {
  label: string;
  columns: { label: string; numeric?: boolean }[];
  children: ReactNode;
}) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto focus-visible:ring-2 focus-visible:ring-inset">
      <table className="w-full text-left">
        <thead className="border-b bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map(({ label, numeric }) => (
              <th key={label} scope="col" className={cn(listThClass, "whitespace-nowrap", numeric && "text-right")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function TenantsTable({ rows }: { rows: PlatformTenantSummary[] }) {
  const columns = [{ label: "Empresa" }, { label: "Cadastro" }, ...metrics.map(({ label }) => ({ label, numeric: true }))];

  return (
    <PlatformTable label="Empresas cadastradas" columns={columns}>
      {rows.map((tenant) => (
        <tr key={tenant.id} className="hover:bg-muted/40">
          <th scope="row" className={cn(listTdNameClass, "min-w-40")}>
            <Link href={`${PLATFORM_TENANTS_PATH}/${tenant.id}`} prefetch={false} className="text-primary underline-offset-4 hover:underline focus-visible:underline">
              {tenant.name}
            </Link>
          </th>
          <td className={cn(listTdClass, "whitespace-nowrap")}><PlatformDate value={tenant.createdAt} /></td>
          {metrics.map(({ key }) => (
            <td key={key} className={cn(listTdClass, "text-right tabular-nums")}>
              {numberFormat.format(tenant[key])}
            </td>
          ))}
        </tr>
      ))}
    </PlatformTable>
  );
}

export function TenantMetrics({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map(({ label, key }) => (
        <Card key={key} className="gap-1 px-4">
          <dt className="font-medium text-muted-foreground">{label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{numberFormat.format(tenant[key])}</dd>
          {key === "customerCount" ? (
            <dd className="text-xs text-muted-foreground">{numberFormat.format(tenant.externalCustomerCount)} externos</dd>
          ) : null}
          {key === "peopleCount" ? (
            <dd className="text-xs text-muted-foreground">
              {numberFormat.format(tenant.enabledPeopleCount)} habilitadas · {numberFormat.format(tenant.peopleCount - tenant.enabledPeopleCount)} desabilitadas
            </dd>
          ) : null}
        </Card>
      ))}
    </dl>
  );
}
