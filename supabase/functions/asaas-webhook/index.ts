import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendTemplateEmail } from "../_shared/email.ts";

type Payment = {
  customer?: string;
  subscription?: string;
  externalReference?: string;
  dueDate?: string;
};

type EventBody = {
  id?: string;
  event?: string;
  payment?: Payment;
};

const ACTIVE = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const PAST_DUE = new Set(["PAYMENT_OVERDUE", "PAYMENT_REFUNDED"]);
const CANCELED = new Set(["SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);

  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const received = req.headers.get("asaas-access-token");
  if (!expected || received !== expected) return json({ error: "Não autorizado." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Função sem configuração." }, 500);

  let body: EventBody;
  try {
    body = (await req.json()) as EventBody;
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  const eventId = String(body.id ?? "").trim();
  const event = String(body.event ?? "").trim();
  if (!eventId || !event) return json({ error: "Evento inválido." }, 400);

  const db = createClient(url, serviceKey);
  const { error: insertError } = await db.from("asaas_webhook_event").insert({ id: eventId, event });
  if (insertError) {
    if (insertError.code === "23505") return json({ ok: true, duplicate: true });
    return json({ error: "Não foi possível registrar o evento." }, 500);
  }

  const payment = body.payment ?? {};
  const tenantId = await resolveTenant(db, payment);
  if (!tenantId) return json({ ok: true, ignored: true });

  let status: string | null = null;
  if (ACTIVE.has(event)) status = "ACTIVE";
  else if (PAST_DUE.has(event)) status = "PAST_DUE";
  else if (CANCELED.has(event)) status = "CANCELED";
  if (!status) return json({ ok: true, ignored: true });

  const periodEnd = status === "ACTIVE" ? addMonth(payment.dueDate) : null;
  const { data: updated } = await db
    .from("subscription")
    .update({
      status,
      asaas_customer_id: payment.customer ?? null,
      asaas_subscription_id: payment.subscription ?? null,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .select("plan_id")
    .maybeSingle();

  if (updated && (status === "ACTIVE" || status === "PAST_DUE")) {
    await notify(db, tenantId, updated.plan_id, status);
  }

  return json({ ok: true });
});

async function resolveTenant(
  db: ReturnType<typeof createClient>,
  payment: Payment,
) {
  const reference = payment.externalReference?.trim() ?? "";
  if (/^[0-9a-f-]{36}$/i.test(reference)) return reference;
  if (!payment.customer) return null;
  const { data } = await db
    .from("subscription")
    .select("tenant_id")
    .eq("asaas_customer_id", payment.customer)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

async function notify(
  db: ReturnType<typeof createClient>,
  tenantId: string,
  planId: string,
  status: string,
) {
  const [{ data: owner }, { data: tenant }, { data: plan }] = await Promise.all([
    db.from("membership").select("first_name, email").eq("tenant_id", tenantId).eq("is_owner", true).maybeSingle(),
    db.from("tenant").select("name").eq("id", tenantId).maybeSingle(),
    db.from("plan").select("name").eq("id", planId).maybeSingle(),
  ]);
  if (!owner?.email) return;

  const site = (Deno.env.get("APP_URL") ?? "https://ativhub.sgapps.org").replace(/\/$/, "");
  await sendTemplateEmail({
    templateCode: status === "ACTIVE" ? "SUBSCRIPTION_ACTIVE" : "SUBSCRIPTION_PAST_DUE",
    to: owner.email,
    variables: {
      name: owner.first_name || "usuário",
      companyName: tenant?.name || "sua empresa",
      planName: plan?.name || "Padrão",
      link: `${site}/subscription`,
    },
    idempotencyKey: `sub:${tenantId}:${status}:${new Date().toISOString().slice(0, 10)}`,
  });
}

function addMonth(dueDate: string | undefined) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const date = new Date(`${dueDate}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}
