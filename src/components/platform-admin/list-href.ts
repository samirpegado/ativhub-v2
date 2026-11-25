import type { PlatformTenantTab } from "@/lib/platform-admin/queries";

export function platformListHref(
  path: string,
  { search = "", page = 1, tab }: { search?: string; page?: number; tab?: PlatformTenantTab },
) {
  const params = new URLSearchParams();
  if (tab === "people") params.set("tab", tab);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
