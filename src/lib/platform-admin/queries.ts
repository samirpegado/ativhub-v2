import { notFound } from "next/navigation";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { Json } from "@/lib/supabase/database.types";
import { requirePlatformOperator } from "./access";

export type PlatformTenantSummary = {
  id: string;
  name: string;
  createdAt: string;
  assetCount: number;
  workOrderCount: number;
  customerCount: number;
  externalCustomerCount: number;
  locationCount: number;
  peopleCount: number;
  enabledPeopleCount: number;
};

export type PlatformCustomer = {
  id: string;
  name: string;
  isInternal: boolean;
  customerType: string | null;
};

export type PlatformPerson = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  roleName: string | null;
  enabled: boolean;
  lastSignInAt: string | null;
};

export type PlatformTenantTab = "customers" | "people";
type ListParams = { search: string; page: number };
type Screen<T> = { total: number; rows: T[] };
type PlatformTenantScreen = { tenant: PlatformTenantSummary } & (
  | ({ tab: "customers" } & Screen<PlatformCustomer>)
  | ({ tab: "people" } & Screen<PlatformPerson>)
);

const MAX_SEARCH_LENGTH = 120;
const MAX_PAGE = Math.floor(2_147_483_647 / LIST_PAGE_SIZE) + 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getPlatformListParams(input: { q?: string | string[]; page?: string | string[] }): ListParams {
  const search = typeof input.q === "string" ? input.q.trim() : "";
  const page = typeof input.page === "string" ? Number(input.page) : 1;
  return {
    search: Array.from(search).slice(0, MAX_SEARCH_LENGTH).join(""),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1,
  };
}

function rpcListArgs({ search, page }: ListParams) {
  return {
    p_search: search,
    p_limit: LIST_PAGE_SIZE,
    p_offset: (page - 1) * LIST_PAGE_SIZE,
  };
}

function readScreen<T>(data: Json): Screen<T> {
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      typeof data.total !== "number" || !Array.isArray(data.rows)) {
    throw new Error("A consulta de administração retornou um resultado inválido.");
  }
  return { total: data.total, rows: data.rows as T[] };
}

export async function loadPlatformTenants(params: ListParams) {
  const { supabase } = await requirePlatformOperator();
  const { data, error } = await supabase.rpc("platform_tenants_screen", rpcListArgs(params));
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Não foi possível carregar as empresas.");
  return readScreen<PlatformTenantSummary>(data);
}

export async function loadPlatformTenant({ tenantId, tab, ...params }: ListParams & {
  tenantId: string;
  tab: PlatformTenantTab;
}): Promise<PlatformTenantScreen | null> {
  const { supabase } = await requirePlatformOperator();
  if (!UUID_PATTERN.test(tenantId)) return null;

  const { data, error } = await supabase.rpc("platform_tenant_screen", {
    p_tenant_id: tenantId,
    p_tab: tab,
    ...rpcListArgs(params),
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Não foi possível carregar a empresa.");
  if (data === null) return null;
  if (typeof data !== "object" || Array.isArray(data) || !data.tenant ||
      typeof data.tenant !== "object" || Array.isArray(data.tenant)) {
    throw new Error("O detalhe da empresa retornou um resultado inválido.");
  }

  const tenant = data.tenant as PlatformTenantSummary;
  return tab === "people"
    ? { tab, tenant, ...readScreen<PlatformPerson>(data) }
    : { tab, tenant, ...readScreen<PlatformCustomer>(data) };
}
