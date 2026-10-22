export type RequestRecord = {
  id: string;
  customId: string | null;
  title: string;
  description: string | null;
  requesterName: string | null;
  requesterPhone: string | null;
  createdAt: string;
  cancelled: boolean;
  cancellationReason: string | null;
  workOrderId: string | null;
  workOrderCustomId: string | null;
  assetId: string | null;
  assetName: string | null;
  locationId: string | null;
  locationName: string | null;
};

export type RequestsScreen = {
  items: RequestRecord[];
  total: number;
  totalAll: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function countOf(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? count : 0;
}

export function requestState(item: Pick<RequestRecord, "cancelled" | "workOrderId">) {
  if (item.workOrderId) return "approved" as const;
  if (item.cancelled) return "rejected" as const;
  return "pending" as const;
}

export function readRequestsScreen(data: unknown): RequestsScreen {
  const screen = asRecord(data);
  const items = Array.isArray(screen?.items) ? screen.items : [];
  return {
    total: countOf(screen?.total),
    totalAll: countOf(screen?.totalAll),
    items: items.flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const title = text(row?.title);
      const createdAt = text(row?.createdAt);
      if (!row || !id || !title || !createdAt) return [];
      return [
        {
          id,
          customId: text(row.customId),
          title,
          description: text(row.description),
          requesterName: text(row.requesterName),
          requesterPhone: text(row.requesterPhone),
          createdAt,
          cancelled: row.cancelled === true,
          cancellationReason: text(row.cancellationReason),
          workOrderId: text(row.workOrderId),
          workOrderCustomId: text(row.workOrderCustomId),
          assetId: text(row.assetId),
          assetName: text(row.assetName),
          locationId: text(row.locationId),
          locationName: text(row.locationName),
        },
      ];
    }),
  };
}
