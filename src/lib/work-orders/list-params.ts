import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPES,
  isWorkOrderPriority,
  isWorkOrderStatus,
  isWorkOrderType,
} from "@/lib/work-orders/status";

export const DEFAULT_WORK_ORDER_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETE"];
export const DEFAULT_WORK_ORDER_PRIORITIES = WORK_ORDER_PRIORITIES.map((item) => item.value);

export type WorkOrderListQuery = {
  search: string;
  statuses: string[];
  priorities: string[];
  locationIds: string[];
  types: string[];
  overdue: boolean;
  dueFrom: string | null;
  dueTo: string | null;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  if (!ISO_DATE.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

export function parseWorkOrderListQuery(input: {
  q?: string;
  status?: string;
  priority?: string;
  location?: string;
  type?: string;
  overdue?: string;
  from?: string;
  to?: string;
  page?: string;
  view?: string;
}): WorkOrderListQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  let dueFrom = parseDate(input.from);
  let dueTo = parseDate(input.to);
  if (dueFrom && dueTo && dueFrom > dueTo) {
    const swap = dueFrom;
    dueFrom = dueTo;
    dueTo = swap;
  }
  return {
    search: (input.q ?? "").trim(),
    statuses: parseSelection(input.status, isWorkOrderStatus, DEFAULT_WORK_ORDER_STATUSES),
    priorities: parseSelection(
      input.priority,
      isWorkOrderPriority,
      DEFAULT_WORK_ORDER_PRIORITIES,
    ),
    locationIds: parseSelection(input.location, (item) => UUID.test(item), []),
    types: parseSelection(input.type, isWorkOrderType, WORK_ORDER_TYPES.map((item) => item.value)),
    overdue: input.overdue === "1",
    dueFrom,
    dueTo,
    page,
    offset: (page - 1) * LIST_PAGE_SIZE,
    calendar: input.view === "calendar",
  };
}

export function workOrderActiveFilterCount(query: {
  statuses: string[];
  priorities: string[];
  locationIds: string[];
  types: string[];
  overdue: boolean;
  dueFrom: string | null;
  dueTo: string | null;
}) {
  let count = 0;
  if (!sameSelection(query.statuses, DEFAULT_WORK_ORDER_STATUSES)) count += 1;
  if (!sameSelection(query.priorities, DEFAULT_WORK_ORDER_PRIORITIES)) count += 1;
  if (!sameSelection(query.types, WORK_ORDER_TYPES.map((item) => item.value))) count += 1;
  if (query.locationIds.length > 0) count += 1;
  if (query.overdue) count += 1;
  if (query.dueFrom || query.dueTo) count += 1;
  return count;
}

export function workOrderListHref(query: {
  search: string;
  statuses: string[];
  priorities: string[];
  locationIds: string[];
  types: string[];
  overdue: boolean;
  dueFrom: string | null;
  dueTo: string | null;
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
  if (query.locationIds.length > 0) params.set("location", query.locationIds.join(","));
  if (!sameSelection(query.types, WORK_ORDER_TYPES.map((item) => item.value))) {
    params.set("type", query.types.join(","));
  }
  if (query.overdue) params.set("overdue", "1");
  if (query.dueFrom) params.set("from", query.dueFrom);
  if (query.dueTo) params.set("to", query.dueTo);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.calendar) params.set("view", "calendar");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function workOrderPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}
