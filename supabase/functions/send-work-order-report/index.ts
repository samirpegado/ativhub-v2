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

function canEditOrders(roleCode: string, isOwner: boolean, permissions: unknown) {
  if (isOwner || roleCode === "ADMIN") return true;
  if (!permissions || typeof permissions !== "object") return false;
  const areas = (permissions as { areas?: { work_orders?: { edit?: boolean } } }).areas;
  return areas?.work_orders?.edit === true;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  if (!membership || !canEditOrders(role?.code ?? "", membership.is_owner, role?.permissions)) {
    return json({ error: "Sem permissão para enviar o relatório." }, 403);
  }

  const { data: order } = await userClient
    .from("work_order")
    .select("id, custom_id, title, description, status, type, due_date, tenant_id")
    .eq("id", workOrderId)
    .maybeSingle();
  if (!order) return json({ error: "Ordem não encontrada." }, 404);

  const [{ data: tasks }, { data: parts }, { data: labors }, { data: tenant }] = await Promise.all([
    userClient.from("task").select("label, value").eq("work_order_id", order.id).order("order_index"),
    userClient.from("work_order_part").select("quantity, part:part_id(name, cost)").eq("work_order_id", order.id),
    userClient.from("labor").select("duration_seconds, hourly_rate").eq("work_order_id", order.id),
    userClient.from("tenant").select("name").eq("id", order.tenant_id).maybeSingle(),
  ]);

  const partLines = (parts ?? []).map((line) => {
    const part = Array.isArray(line.part) ? line.part[0] : line.part;
    const cost = Number(part?.cost ?? 0) * Number(line.quantity ?? 0);
    return `${part?.name ?? "Peça"} × ${line.quantity}: ${money(cost)}`;
  });
  const laborCost = (labors ?? []).reduce(
    (sum, labor) => sum + (Number(labor.duration_seconds ?? 0) / 3600) * Number(labor.hourly_rate ?? 0),
    0,
  );
  const taskLines = (tasks ?? []).map((task) => `- ${task.label}${task.value ? `: ${task.value}` : ""}`);
  const summary = [
    `Status: ${order.status}`,
    `Tipo: ${order.type}`,
    order.due_date ? `Vencimento: ${order.due_date}` : "",
    order.description ?? "",
    taskLines.length ? `Tarefas:\n${taskLines.join("\n")}` : "",
    partLines.length ? `Peças:\n${partLines.join("\n")}` : "",
    `Mão de obra: ${money(laborCost)}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 20000);

  const sent = await sendTemplateEmail({
    templateCode: "WORK_ORDER_REPORT",
    to,
    variables: {
      recipientName,
      customId: order.custom_id ?? "",
      title: order.title,
      companyName: tenant?.name ?? "AtivHub",
      summary,
    },
  });
  if (!sent.ok) return json({ error: sent.error }, sent.status);
  return json({ ok: true });
});
