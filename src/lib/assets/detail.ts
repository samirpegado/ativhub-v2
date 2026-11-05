import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { signStoragePaths } from "@/lib/storage/signed-url";

export type AssetDetailEvent =
  | {
      kind: "work_order";
      at: string;
      id: string;
      customId: string | null;
      title: string;
      status: string;
      type: "PREVENTIVE" | "CORRECTIVE";
      partsCost: number;
      laborCost: number;
    }
  | {
      kind: "downtime";
      at: string;
      id: string;
      durationSeconds: number;
      open: boolean;
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
    area: string | null;
    acquisitionCost: number | null;
    inServiceDate: string | null;
    warrantyExpirationDate: string | null;
    locationName: string | null;
    categoryName: string | null;
    imageUrl: string | null;
  };
  maintenanceCost: number;
  workOrderCount: number;
  downtimeSeconds: number;
  availability: number | null;
  mttrSeconds: number | null;
  mtbfSeconds: number | null;
  events: AssetDetailEvent[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function num(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown) {
  return num(value) ?? 0;
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
  const events: AssetDetailEvent[] = (Array.isArray(detail.events) ? detail.events : []).flatMap((item): AssetDetailEvent[] => {
    const event = asRecord(item);
    const kind = text(event?.kind);
    const at = text(event?.at);
    const eventId = text(event?.id);
    if (!event || !kind || !at || !eventId) return [];
    if (kind === "downtime") {
      return [
        {
          kind: "downtime" as const,
          at,
          id: eventId,
          durationSeconds: money(event.durationSeconds),
          open: event.open === true,
        },
      ];
    }
    if (kind !== "work_order") return [];
    const title = text(event.title);
    if (!title) return [];
    return [
      {
        kind: "work_order" as const,
        at,
        id: eventId,
        customId: text(event.customId),
        title,
        status: text(event.status) ?? "OPEN",
        type: text(event.type) === "PREVENTIVE" ? ("PREVENTIVE" as const) : ("CORRECTIVE" as const),
        partsCost: money(event.partsCost),
        laborCost: money(event.laborCost),
      },
    ];
  });

  const tracked = Math.max(0, money(detail.trackedSeconds));
  const downtime = Math.min(tracked, Math.max(0, money(detail.downtimeSeconds)));
  const failures = Math.max(0, money(detail.failureCount));
  const mttr = num(detail.mttrSeconds);

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
      area: text(row.area),
      acquisitionCost: num(row.acquisitionCost),
      inServiceDate: text(row.inServiceDate),
      warrantyExpirationDate: text(row.warrantyExpirationDate),
      locationName: text(row.locationName),
      categoryName: text(row.categoryName),
      imageUrl: imagePath ? (signed[0] ?? null) : null,
    },
    maintenanceCost: money(detail.maintenanceCost),
    workOrderCount: money(detail.workOrderCount),
    downtimeSeconds: downtime,
    availability: tracked > 0 ? (tracked - downtime) / tracked : null,
    mttrSeconds: mttr != null && mttr >= 0 ? mttr : null,
    mtbfSeconds: failures > 0 ? (tracked - downtime) / failures : null,
    events,
  };
}
