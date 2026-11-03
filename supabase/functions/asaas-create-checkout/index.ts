import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { asaasConfig } from "../_shared/asaas.ts";

type Body = { planId?: string };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anon || !serviceKey || !auth) return json({ error: "Não autorizado." }, 401);

  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData.user;
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (userError || !user || !tenantId) return json({ error: "Não autorizado." }, 401);

  const admin = createClient(url, serviceKey);
  const { data: membership } = await admin
    .from("membership")
    .select("is_owner, role:role_id(code)")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .maybeSingle();

  const role = membership?.role as { code: string } | { code: string }[] | null;
  const code = Array.isArray(role) ? role[0]?.code : role?.code;
  if (!membership || (code !== "ADMIN" && membership.is_owner !== true)) {
    return json({ error: "Só um administrador pode assinar." }, 403);
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  let planQuery = admin.from("plan").select("id, name, amount, interval").eq("is_active", true);
  planQuery = body.planId ? planQuery.eq("id", body.planId) : planQuery.eq("code", "STANDARD");
  const { data: plan } = await planQuery.maybeSingle();
  if (!plan) return json({ error: "Plano indisponível." }, 404);

  const { data: subscription } = await admin
    .from("subscription")
    .select("checkout_url, checkout_env")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const asaas = asaasConfig();
  if (!asaas.apiKey) return json({ error: "Pagamento sem configuração." }, 500);
  if (subscription?.checkout_url && subscription.checkout_env === asaas.env) {
    return json({ url: subscription.checkout_url });
  }

  const response = await fetch(`${asaas.baseUrl}/v3/paymentLinks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      access_token: asaas.apiKey,
    },
    body: JSON.stringify({
      name: `AtivHub ${plan.name}`,
      description: "Assinatura do AtivHub",
      value: plan.amount,
      billingType: "UNDEFINED",
      chargeType: "RECURRENT",
      subscriptionCycle: plan.interval === "MONTHLY" ? "MONTHLY" : plan.interval,
      dueDateLimitDays: 5,
      externalReference: tenantId,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; url?: string };
  if (!response.ok || !payload.url || !payload.id) {
    return json({ error: "Não foi possível abrir o pagamento." }, 502);
  }

  await admin.from("subscription").update({
    plan_id: plan.id,
    asaas_payment_link_id: payload.id,
    checkout_url: payload.url,
    checkout_env: asaas.env,
    updated_at: new Date().toISOString(),
  }).eq("tenant_id", tenantId);

  return json({ url: payload.url });
});
