import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { ASSET_STATUSES, type AssetStatus } from "@/lib/assets/status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AssetListQuery = {
  search: string;
  statuses: AssetStatus[];
  categoryIds: string[];
  locationIds: string[];
  page: number;
  offset: number;
};

function isAssetStatus(value: string): value is AssetStatus {
  return ASSET_STATUSES.some((item) => item.value === value);
}

function parseList<T extends string>(value: string | undefined, accept: (item: string) => item is T): T[];
function parseList(value: string | undefined, accept: (item: string) => boolean): string[];
function parseList(value: string | undefined, accept: (item: string) => boolean) {
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(accept))];
}

export function parseAssetListQuery(input: {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  page?: string;
}): AssetListQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  return {
    search: (input.q ?? "").trim(),
    statuses: parseList(input.status, isAssetStatus),
    categoryIds: parseList(input.category, (item) => UUID.test(item)),
    locationIds: parseList(input.location, (item) => UUID.test(item)),
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
  };
}

export function assetActiveFilterCount(query: Pick<AssetListQuery, "statuses" | "categoryIds" | "locationIds">) {
  let count = 0;
  if (query.statuses.length > 0) count += 1;
  if (query.categoryIds.length > 0) count += 1;
  if (query.locationIds.length > 0) count += 1;
  return count;
}

export function assetListHref(query: {
  search: string;
  statuses: string[];
  categoryIds: string[];
  locationIds: string[];
  page: number;
}) {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search) params.set("q", search);
  if (query.statuses.length > 0) params.set("status", query.statuses.join(","));
  if (query.categoryIds.length > 0) params.set("category", query.categoryIds.join(","));
  if (query.locationIds.length > 0) params.set("location", query.locationIds.join(","));
  if (query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `/assets?${qs}` : "/assets";
}

export function assetPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
