"use server";

import { requireArea } from "@/lib/auth/permissions";
import type { WorkOrderPartOption } from "@/lib/work-orders/activity";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function searchWorkOrderLocations(term: string, selectedIds: string[]) {
  const { supabase } = await requireArea("work_orders", "view");
  const ids = [...new Set(selectedIds.filter((id) => UUID.test(id)))];
  const text = term.trim().replace(/[%_\\]/g, "").slice(0, 80);
  let request = supabase.from("location").select("id, name").order("name").limit(20);
  if (text) request = request.ilike("name", `%${text}%`);
  const { data, error } = await request;
  if (error) return [];
  const found = (data ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : []));
  const missing = ids.filter((id) => !found.some((item) => item.id === id));
  if (missing.length === 0) return found;
  const extra = await supabase.from("location").select("id, name").in("id", missing);
  const pinned = (extra.data ?? []).flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : []));
  return [...pinned, ...found];
}

export async function searchWorkOrderParts(term: string): Promise<WorkOrderPartOption[]> {
  const { supabase } = await requireArea("work_orders", "view");
  const text = term.trim().replace(/[%_\\,]/g, "").slice(0, 80);
  let request = supabase
    .from("part")
    .select("id, name, description, bar_code, unit, cost, quantity, non_stock")
    .order("name")
    .limit(20);
  if (text) {
    request = request.or(
      `name.ilike.%${text}%,description.ilike.%${text}%,bar_code.ilike.%${text}%`,
    );
  }
  const { data, error } = await request;
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    cost: Number(row.cost ?? 0),
    quantity: Number(row.quantity ?? 0),
    nonStock: row.non_stock,
  }));
}
