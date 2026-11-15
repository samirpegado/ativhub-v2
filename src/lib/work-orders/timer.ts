import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function stopRunningWorkOrderTimers(supabase: Client, workOrderId: string) {
  const { data, error } = await supabase
    .from("labor")
    .select("id, duration_seconds, started_at, tracked_at")
    .eq("work_order_id", workOrderId)
    .eq("logged", true)
    .not("started_at", "is", null);
  if (error) throw new Error("Não foi possível parar o temporizador.");

  const now = Date.now();
  for (const row of data ?? []) {
    if (!row.started_at) continue;
    const extra = Math.max(0, Math.floor((now - new Date(row.started_at).getTime()) / 1000));
    const { error: updateError } = await supabase
      .from("labor")
      .update({
        duration_seconds: row.duration_seconds + extra,
        started_at: null,
        tracked_at: row.tracked_at ?? row.started_at,
      })
      .eq("id", row.id);
    if (updateError) throw new Error("Não foi possível parar o temporizador.");
  }
}
