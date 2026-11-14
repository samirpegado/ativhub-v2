import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendTemplateEmail } from "../_shared/email.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function canSendOrders(roleCode: string, isOwner: boolean, permissions: unknown) {
  if (isOwner || roleCode === "ADMIN") return true;
  if (!permissions || typeof permissions !== "object") return false;
  const area = (permissions as { areas?: { work_orders?: { view?: boolean; edit?: boolean } } }).areas?.work_orders;
  return area?.view === true || area?.edit === true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  if (!url || !anon || !auth) return json({ error: "Não autorizado." }, 401);

  let body: { workOrderId?: string; to?: string; recipientName?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  const workOrderId = body.workOrderId?.trim() ?? "";
  const to = body.to?.trim().toLowerCase() ?? "";
  const recipientName = (body.recipientName ?? "").trim().slice(0, 80) || "cliente";
  if (!/^[0-9a-f-]{36}$/i.test(workOrderId) || !EMAIL.test(to)) {
    return json({ error: "Dados inválidos." }, 400);
  }

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "Não autorizado." }, 401);

  const { data: membership } = await userClient
    .from("membership")
    .select("is_owner, role:role_id(code, permissions)")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  const role = Array.isArray(membership?.role) ? membership.role[0] : membership?.role;
  if (!membership || !canSendOrders(role?.code ?? "", membership.is_owner, role?.permissions)) {
    return json({ error: "Sem permissão para enviar a ordem." }, 403);
  }

  const { data: order } = await userClient
    .from("work_order")
    .select("id, custom_id, title, tenant_id, archived")
    .eq("id", workOrderId)
    .maybeSingle();
  if (!order || order.archived) return json({ error: "Ordem não encontrada." }, 404);

  const { data: tenant } = await userClient.from("tenant").select("name").eq("id", order.tenant_id).maybeSingle();
  const site = (Deno.env.get("APP_URL") ?? "https://ativhub.sgapps.org").replace(/\/$/, "");
  const sent = await sendTemplateEmail({
    templateCode: "WORK_ORDER_REPORT",
    to,
    variables: {
      recipientName,
      customId: order.custom_id ?? "Ordem de serviço",
      title: order.title,
      companyName: tenant?.name ?? "AtivHub",
      link: `${site}/work-orders/${order.id}/print`,
    },
  });
  if (!sent.ok) return json({ error: sent.error }, sent.status);
  return json({ ok: true });
});
