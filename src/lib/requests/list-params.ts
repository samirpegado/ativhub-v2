import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";

export const REQUEST_STATUSES = [
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Recusadas" },
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number]["value"];

export type RequestListQuery = {
  search: string;
  status: RequestStatus | null;
  page: number;
  offset: number;
};

function isStatus(value: string): value is RequestStatus {
  return REQUEST_STATUSES.some((item) => item.value === value);
}

export function parseRequestQuery(input: {
  q?: string;
  status?: string;
  page?: string;
}): RequestListQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  return {
    search: (input.q ?? "").trim(),
    status: input.status && isStatus(input.status) ? input.status : null,
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
  };
}

export function requestHref(query: { search: string; status: RequestStatus | null; page: number }) {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search) params.set("q", search);
  if (query.status) params.set("status", query.status);
  if (query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `/requests?${qs}` : "/requests";
}

export function requestPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
