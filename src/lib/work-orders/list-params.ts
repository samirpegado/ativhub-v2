import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import {
  WORK_ORDER_PRIORITIES,
  isWorkOrderPriority,
  isWorkOrderStatus,
} from "@/lib/work-orders/status";

export const DEFAULT_WORK_ORDER_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD"];
export const DEFAULT_WORK_ORDER_PRIORITIES = WORK_ORDER_PRIORITIES.map((item) => item.value);

export type WorkOrderListQuery = {
  search: string;
  statuses: string[];
  priorities: string[];
  page: number;
  offset: number;
  calendar: boolean;
};

function sameSelection(left: string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const known = new Set(right);
  return left.every((item) => known.has(item));
}

function parseSelection(
  value: string | undefined,
  accept: (item: string) => boolean,
  fallback: readonly string[],
) {
  if (value === undefined) return [...fallback];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(accept))];
}

export function parseWorkOrderListQuery(input: {
  q?: string;
  status?: string;
  priority?: string;
  page?: string;
  view?: string;
}): WorkOrderListQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  return {
    search: (input.q ?? "").trim(),
    statuses: parseSelection(input.status, isWorkOrderStatus, DEFAULT_WORK_ORDER_STATUSES),
    priorities: parseSelection(
      input.priority,
      isWorkOrderPriority,
      DEFAULT_WORK_ORDER_PRIORITIES,
    ),
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
    calendar: input.view === "calendar",
  };
}

export function workOrderListHref(query: {
  search: string;
  statuses: string[];
  priorities: string[];
  page: number;
  calendar?: boolean;
}) {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search) params.set("q", search);
  if (!sameSelection(query.statuses, DEFAULT_WORK_ORDER_STATUSES)) {
    params.set("status", query.statuses.join(","));
  }
  if (!sameSelection(query.priorities, DEFAULT_WORK_ORDER_PRIORITIES)) {
    params.set("priority", query.priorities.join(","));
  }
  if (query.page > 1) params.set("page", String(query.page));
  if (query.calendar) params.set("view", "calendar");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function workOrderPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
