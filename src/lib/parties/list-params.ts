import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";

export type PartyListQuery = {
  search: string;
  page: number;
  offset: number;
  customers: boolean;
};

export function parsePartyQuery(input: {
  q?: string;
  page?: string;
  tab?: string;
}): PartyListQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  return {
    search: (input.q ?? "").trim(),
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
    customers: input.tab === "customers",
  };
}

export function partyHref(query: { search: string; page: number; customers?: boolean }) {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search) params.set("q", search);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.customers) params.set("tab", "customers");
  const qs = params.toString();
  return qs ? `/parties?${qs}` : "/parties";
}

export function partyPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
