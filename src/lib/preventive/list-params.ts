import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { isWorkOrderPriority } from "@/lib/work-orders/status";

export type PreventiveListQuery = {
  search: string;
  priority: string | null;
  page: number;
  offset: number;
};

export function parsePreventiveQuery(params: { q?: string; priority?: string; page?: string }) {
  const page = Math.max(1, Number(params.page) || 1);
  const priority = params.priority && isWorkOrderPriority(params.priority) ? params.priority : null;
  return {
    search: params.q?.trim() ?? "",
    priority,
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
  } satisfies PreventiveListQuery;
}

export function preventiveHref(query: Pick<PreventiveListQuery, "search" | "priority" | "page">) {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.priority) params.set("priority", query.priority);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `/preventive?${text}` : "/preventive";
}

export function preventivePageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
