"use server";

import { requireArea } from "@/lib/auth/permissions";
import type { WorkOrderPartOption } from "@/lib/work-orders/activity";

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
