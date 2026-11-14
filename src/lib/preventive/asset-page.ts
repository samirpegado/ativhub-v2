export const PREVENTIVE_PAGE_SIZE = 10;

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function parsePreventiveDetailQuery(input: { page?: string; ordens?: string }) {
  return {
    assets: parsePage(input.page),
    orders: parsePage(input.ordens),
  };
}

export function preventivePageCount(total: number) {
  return Math.max(1, Math.ceil(total / PREVENTIVE_PAGE_SIZE));
}

export function preventiveDetailHref(
  scheduleId: string,
  query: { assets?: number; orders?: number } = {},
) {
  const params = new URLSearchParams();
  if ((query.assets ?? 1) > 1) params.set("page", String(query.assets));
  if ((query.orders ?? 1) > 1) params.set("ordens", String(query.orders));
  const qs = params.toString();
  return qs ? `/preventive/${scheduleId}?${qs}` : `/preventive/${scheduleId}`;
}
