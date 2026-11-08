export const ASSET_HISTORY_PAGE_SIZE = 10;

export type AssetHistoryType = "CORRECTIVE" | "PREVENTIVE" | "PREDICTIVE";

const HISTORY_TYPES = {
  corretiva: "CORRECTIVE",
  preventiva: "PREVENTIVE",
  preditiva: "PREDICTIVE",
} as const satisfies Record<string, AssetHistoryType>;

export type AssetHistoryQuery = {
  page: number;
  type: AssetHistoryType | null;
  offset: number;
};

export function parseAssetHistoryQuery(input: { page?: string; tipo?: string }): AssetHistoryQuery {
  const parsed = Number.parseInt(input.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  const type = HISTORY_TYPES[input.tipo as keyof typeof HISTORY_TYPES] ?? null;
  return {
    page,
    type,
    offset: (page - 1) * ASSET_HISTORY_PAGE_SIZE,
  };
}

export function assetHistoryPageCount(total: number) {
  return Math.max(1, Math.ceil(total / ASSET_HISTORY_PAGE_SIZE));
}

export function assetDetailHref(
  assetId: string,
  query: { page?: number; type?: AssetHistoryType | null },
) {
  const params = new URLSearchParams();
  if (query.type === "CORRECTIVE") params.set("tipo", "corretiva");
  else if (query.type === "PREVENTIVE") params.set("tipo", "preventiva");
  else if (query.type === "PREDICTIVE") params.set("tipo", "preditiva");
  if ((query.page ?? 1) > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `/assets/${assetId}?${qs}` : `/assets/${assetId}`;
}
