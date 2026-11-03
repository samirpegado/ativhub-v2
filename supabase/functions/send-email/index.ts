import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sendTemplateEmail } from "../_shared/email.ts";

type SendBody = {
  templateCode?: string;
  to?: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isServiceRole(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(serviceKey) && token === serviceKey;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  if (!isServiceRole(req)) return json({ error: "Não autorizado." }, 401);

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  if (body.variables && (typeof body.variables !== "object" || Array.isArray(body.variables))) {
    return json({ error: "Variáveis inválidas." }, 400);
  }

  const result = await sendTemplateEmail({
    templateCode: String(body.templateCode ?? ""),
    to: String(body.to ?? ""),
    variables: body.variables,
    idempotencyKey: body.idempotencyKey,
  });

  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, duplicate: result.duplicate });
});
