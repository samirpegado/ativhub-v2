import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { signStoragePaths } from "@/lib/storage/signed-url";

export type PartRecord = {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  quantity: number;
  minQuantity: number;
  nonStock: boolean;
  unit: string | null;
  barcode: string | null;
  area: string | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export type PartCategory = { id: string; name: string };

export type PartsScreen = {
  parts: PartRecord[];
  total: number;
  totalAll: number;
  categories: PartCategory[];
};

export type StockMovement = {
  id: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  workOrderId: string | null;
  workOrderCustomId: string | null;
  workOrderTitle: string | null;
};

export type PartWorkOrder = {
  id: string;
  customId: string | null;
  title: string;
  status: string;
  quantity: number;
};

export type PartDetail = {
  part: PartRecord;
  movements: StockMovement[];
  workOrders: PartWorkOrder[];
};

export type PartOption = {
  id: string;
  name: string;
  cost: number;
  unit: string | null;
};

export type PartSetRecord = {
  id: string;
  name: string;
  createdAt: string;
  partCount: number;
  totalCost: number;
  partIds: string[];
};

export type PartSetsScreen = {
  sets: PartSetRecord[];
  total: number;
  totalAll: number;
  parts: PartOption[];
};

export type PartSetDetail = {
  id: string;
  name: string;
  createdAt: string;
  totalCost: number;
  parts: PartOption[];
};

type Client = SupabaseClient<Database>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapPart(row: Record<string, unknown>, imageUrl: string | null): PartRecord | null {
  const id = text(row.id);
  const name = text(row.name);
  const createdAt = text(row.createdAt);
  if (!id || !name || !createdAt) return null;
  return {
    id,
    name,
    description: text(row.description),
    cost: num(row.cost),
    quantity: num(row.quantity),
    minQuantity: num(row.minQuantity),
    nonStock: row.nonStock === true,
    unit: text(row.unit),
    barcode: text(row.barcode),
    area: text(row.area),
    categoryId: text(row.categoryId),
    categoryName: text(row.categoryName),
    imageUrl,
    createdAt,
  };
}

export async function readPartsScreen(supabase: Client, data: unknown): Promise<PartsScreen> {
  const screen = asRecord(data);
  if (!screen) throw new Error("Não foi possível carregar as peças.");
  const rows = asList(screen.parts).map((item) => asRecord(item));
  const paths = rows
    .map((row) => text(row?.imagePath))
    .filter((path): path is string => Boolean(path));
  const signed = await signStoragePaths(supabase, paths);
  const urls = new Map(paths.map((path, index) => [path, signed[index] ?? null]));
  return {
    parts: rows.flatMap((row) => {
      if (!row) return [];
      const path = text(row.imagePath);
      const part = mapPart(row, path ? (urls.get(path) ?? null) : null);
      return part ? [part] : [];
    }),
    total: num(screen.total),
    totalAll: num(screen.totalAll),
    categories: asList(screen.categories).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const name = text(row?.name);
      if (!id || !name) return [];
      return [{ id, name }];
    }),
  };
}

export async function readPartDetail(supabase: Client, data: unknown): Promise<PartDetail> {
  const detail = asRecord(data);
  const row = asRecord(detail?.part);
  if (!detail || !row) throw new Error("Não foi possível carregar a peça.");
  const path = text(row.imagePath);
  const signed = await signStoragePaths(supabase, path ? [path] : []);
  const part = mapPart(row, path ? (signed[0] ?? null) : null);
  if (!part) throw new Error("Não foi possível carregar a peça.");
  return {
    part,
    movements: asList(detail.movements).flatMap((item) => {
      const movement = asRecord(item);
      const id = text(movement?.id);
      const createdAt = text(movement?.createdAt);
      if (!movement || !id || !createdAt) return [];
      return [
        {
          id,
          quantity: num(movement.quantity),
          reason: text(movement.reason),
          createdAt,
          workOrderId: text(movement.workOrderId),
          workOrderCustomId: text(movement.workOrderCustomId),
          workOrderTitle: text(movement.workOrderTitle),
        },
      ];
    }),
    workOrders: asList(detail.workOrders).flatMap((item) => {
      const order = asRecord(item);
      const id = text(order?.id);
      const title = text(order?.title);
      if (!order || !id || !title) return [];
      return [
        {
          id,
          customId: text(order.customId),
          title,
          status: text(order.status) ?? "OPEN",
          quantity: num(order.quantity),
        },
      ];
    }),
  };
}

function mapOption(value: unknown): PartOption | null {
  const row = asRecord(value);
  const id = text(row?.id);
  const name = text(row?.name);
  if (!row || !id || !name) return null;
  return { id, name, cost: num(row.cost), unit: text(row.unit) };
}

export function readPartSetsScreen(data: unknown): PartSetsScreen {
  const screen = asRecord(data);
  if (!screen) throw new Error("Não foi possível carregar os conjuntos.");
  return {
    sets: asList(screen.sets).flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const name = text(row?.name);
      const createdAt = text(row?.createdAt);
      if (!row || !id || !name || !createdAt) return [];
      return [
        {
          id,
          name,
          createdAt,
          partCount: num(row.partCount),
          totalCost: num(row.totalCost),
          partIds: asList(row.partIds).filter((partId): partId is string => typeof partId === "string"),
        },
      ];
    }),
    total: num(screen.total),
    totalAll: num(screen.totalAll),
    parts: asList(screen.parts).flatMap((item) => {
      const option = mapOption(item);
      return option ? [option] : [];
    }),
  };
}

export function readPartSetDetail(data: unknown): PartSetDetail {
  const detail = asRecord(data);
  const row = asRecord(detail?.set);
  const id = text(row?.id);
  const name = text(row?.name);
  const createdAt = text(row?.createdAt);
  if (!row || !id || !name || !createdAt) {
    throw new Error("Não foi possível carregar o conjunto.");
  }
  return {
    id,
    name,
    createdAt,
    totalCost: num(row.totalCost),
    parts: asList(row.parts).flatMap((item) => {
      const option = mapOption(item);
      return option ? [option] : [];
    }),
  };
}
