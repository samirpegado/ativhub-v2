import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type SubscriptionRow = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan_id: string;
};

type Client = SupabaseClient<Database>;

export function subscriptionIsOpen(row: SubscriptionRow | null) {
  if (!row) return false;
  const now = Date.now();
  if (row.status === "TRIALING" && row.trial_ends_at && Date.parse(row.trial_ends_at) > now) {
    return true;
  }
  if (row.status === "ACTIVE") {
    return !row.current_period_end || Date.parse(row.current_period_end) > now;
  }
  return false;
}

export async function loadSubscription(supabase: Client, tenantId: string) {
  const { data, error } = await supabase
    .from("subscription")
    .select("status, trial_ends_at, current_period_end, plan_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar a assinatura.");
  return {
    subscription: data,
    allowed: subscriptionIsOpen(data),
  };
}
