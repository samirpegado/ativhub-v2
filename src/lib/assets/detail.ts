import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { signStoragePaths } from "@/lib/storage/signed-url";

export type AssetHistoryItem = {
  id: string;
  at: string;
  customId: string | null;
  title: string;
  status: string;
  type: "PREVENTIVE" | "CORRECTIVE" | "PREDICTIVE";
  partsCost: number;
  laborCost: number;
};

export type AssetCostLeader = {
  id: string;
  customId: string | null;
  title: string;
  total: number;
};

export type AssetDetail = {
  asset: {
    id: string;
    customId: string | null;
    name: string;
    description: string | null;
    status: string;
    model: string | null;
    manufacturer: string | null;
    serialNumber: string | null;
    barCode: string | null;
    power: string | null;
    area: string | null;
    additionalInfos: string | null;
    acquisitionCost: number | null;
    inServiceDate: string | null;
    warrantyExpirationDate: string | null;
    locationId: string | null;
    locationName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    imageUrl: string | null;
  };
  partsCost: number;
  laborCost: number;
  maintenanceCost: number;
  workOrderCount: number;
  correctiveCount: number;
  preventiveCount: number;
  predictiveCount: number;
  zeroCostCount: number;
  downtimeSeconds: number;
  availability: number | null;
  mttrSeconds: number | null;
  mtbfSeconds: number | null;
  statusCounts: Record<string, number>;
  costLeaders: AssetCostLeader[];
  history: {
    total: number;
    items: AssetHistoryItem[];
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function day(value: unknown) {
  const raw = text(value);
  return raw ? raw.slice(0, 10) : null;
}

function num(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown) {
  return num(value) ?? 0;
}

function orderType(value: unknown): AssetHistoryItem["type"] {
  const kind = text(value);
  if (kind === "PREVENTIVE" || kind === "PREDICTIVE") return kind;
  return "CORRECTIVE";
}

function statusCounts(value: unknown) {
  const row = asRecord(value);
  if (!row) return {};
  const counts: Record<string, number> = {};
  for (const [status, count] of Object.entries(row)) {
    counts[status] = money(count);
  }
  return counts;
}

function historyItems(value: unknown): AssetHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AssetHistoryItem[] => {
    const event = asRecord(item);
    const id = text(event?.id);
    const at = text(event?.at);
    const title = text(event?.title);
    if (!event || !id || !at || !title) return [];
    return [
      {
        id,
        at,
        customId: text(event.customId),
        title,
        status: text(event.status) ?? "OPEN",
        type: orderType(event.type),
        partsCost: money(event.partsCost),
        laborCost: money(event.laborCost),
      },
    ];
  });
}

function costLeaders(value: unknown): AssetCostLeader[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AssetCostLeader[] => {
    const row = asRecord(item);
    const id = text(row?.id);
    const title = text(row?.title);
    if (!row || !id || !title) return [];
    return [{ id, customId: text(row.customId), title, total: money(row.total) }];
  });
}

export async function readAssetDetail(
  supabase: SupabaseClient<Database>,
  data: unknown,
): Promise<AssetDetail> {
  const detail = asRecord(data);
  const row = asRecord(detail?.asset);
  const id = text(row?.id);
  const name = text(row?.name);
  const status = text(row?.status);
  if (!detail || !row || !id || !name || !status) {
    throw new Error("Não foi possível carregar o ativo.");
  }
  const imagePath = text(row.imagePath);
  const signed = await signStoragePaths(supabase, imagePath ? [imagePath] : []);
  const history = asRecord(detail.history);
  const tracked = Math.max(0, money(detail.trackedSeconds));
  const downtime = Math.min(tracked, Math.max(0, money(detail.downtimeSeconds)));
  const failures = Math.max(0, money(detail.failureCount));
  const mttr = num(detail.mttrSeconds);
  const partsCost = money(detail.partsCost);
  const laborCost = money(detail.laborCost);

  return {
    asset: {
      id,
      customId: text(row.customId),
      name,
      description: text(row.description),
      status,
      model: text(row.model),
      manufacturer: text(row.manufacturer),
      serialNumber: text(row.serialNumber),
      barCode: text(row.barCode),
      power: text(row.power),
      area: text(row.area),
      additionalInfos: text(row.additionalInfos),
      acquisitionCost: num(row.acquisitionCost),
      inServiceDate: day(row.inServiceDate),
      warrantyExpirationDate: day(row.warrantyExpirationDate),
      locationId: text(row.locationId),
      locationName: text(row.locationName),
      categoryId: text(row.categoryId),
      categoryName: text(row.categoryName),
      imageUrl: imagePath ? (signed[0] ?? null) : null,
    },
    partsCost,
    laborCost,
    maintenanceCost: Math.round((partsCost + laborCost) * 100) / 100,
    workOrderCount: money(detail.workOrderCount),
    correctiveCount: money(detail.correctiveCount),
    preventiveCount: money(detail.preventiveCount),
    predictiveCount: money(detail.predictiveCount),
    zeroCostCount: money(detail.zeroCostCount),
    downtimeSeconds: downtime,
    availability: tracked > 0 ? (tracked - downtime) / tracked : null,
    mttrSeconds: mttr != null && mttr >= 0 ? mttr : null,
    mtbfSeconds: failures > 0 ? (tracked - downtime) / failures : null,
    statusCounts: statusCounts(detail.statusCounts),
    costLeaders: costLeaders(detail.costLeaders),
    history: {
      total: money(history?.total),
      items: historyItems(history?.items),
    },
  };
}
