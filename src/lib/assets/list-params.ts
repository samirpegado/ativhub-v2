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

const STATUS_VALUES = ASSET_STATUSES.map((item) => item.value);

function isAssetStatus(value: string): value is AssetStatus {
  return ASSET_STATUSES.some((item) => item.value === value);
}

function sameSelection(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const known = new Set(right);
  return left.every((item) => known.has(item));
}

function parseSelection<T extends string>(
  value: string | undefined,
  accept: (item: string) => item is T,
  all: readonly string[],
): T[];
function parseSelection(value: string | undefined, accept: (item: string) => boolean, all: readonly string[]): string[];
function parseSelection(value: string | undefined, accept: (item: string) => boolean, all: readonly string[]) {
  if (!value) return [];
  const items = [...new Set(value.split(",").map((item) => item.trim()).filter(accept))];
  if (all.length > 0 && sameSelection(items, all)) return [];
  return items;
}

export function narrowsAssetList(selected: string[], all: readonly string[]) {
  return selected.length > 0 && !sameSelection(selected, all);
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
    statuses: parseSelection(input.status, isAssetStatus, STATUS_VALUES),
    categoryIds: parseSelection(input.category, (item) => UUID.test(item), []),
    locationIds: parseSelection(input.location, (item) => UUID.test(item), []),
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
  };
}

export function assetActiveFilterCount(query: Pick<AssetListQuery, "statuses" | "categoryIds" | "locationIds">) {
  let count = 0;
  if (narrowsAssetList(query.statuses, STATUS_VALUES)) count += 1;
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
  if (narrowsAssetList(query.statuses, STATUS_VALUES)) params.set("status", query.statuses.join(","));
  if (query.categoryIds.length > 0) params.set("category", query.categoryIds.join(","));
  if (query.locationIds.length > 0) params.set("location", query.locationIds.join(","));
  if (query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `/assets?${qs}` : "/assets";
}

export function assetPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
