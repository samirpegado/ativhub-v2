import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";

export const STOCK_FILTERS = [
  { value: "low", label: "Estoque baixo" },
  { value: "ok", label: "Estoque ok" },
  { value: "non_stock", label: "Sem controle" },
] as const;

export type StockFilter = (typeof STOCK_FILTERS)[number]["value"];

export type InventoryListQuery = {
  search: string;
  stock: StockFilter | null;
  page: number;
  offset: number;
  sets: boolean;
};

function isStockFilter(value: string): value is StockFilter {
  return STOCK_FILTERS.some((item) => item.value === value);
}

export function parseInventoryQuery(input: {
  q?: string;
  stock?: string;
  page?: string;
  tab?: string;
}): InventoryListQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  const stock = input.stock && isStockFilter(input.stock) ? input.stock : null;
  return {
    search: (input.q ?? "").trim(),
    stock,
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
    sets: input.tab === "sets",
  };
}

export function inventoryHref(query: {
  search: string;
  stock: StockFilter | null;
  page: number;
  sets?: boolean;
}) {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search) params.set("q", search);
  if (!query.sets && query.stock) params.set("stock", query.stock);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.sets) params.set("tab", "sets");
  const qs = params.toString();
  return qs ? `/inventory?${qs}` : "/inventory";
}

export function inventoryPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
