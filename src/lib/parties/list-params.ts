import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";

export type PartySection = "customers" | "vendors";

export type PartyListQuery = {
  search: string;
  page: number;
  offset: number;
};

export function partyPath(section: PartySection) {
  return section === "customers" ? "/customers" : "/vendors";
}

export function parsePartyQuery(input: { q?: string; page?: string }): PartyListQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  return {
    search: (input.q ?? "").trim(),
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
  };
}

export function partyHref(section: PartySection, query: { search: string; page: number }) {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search) params.set("q", search);
  if (query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  const path = partyPath(section);
  return qs ? `${path}?${qs}` : path;
}

export function partyPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
