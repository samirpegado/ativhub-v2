import { createClient } from "jsr:@supabase/supabase-js@2";

const TEMPLATE_CODE = /^[A-Z0-9_]{1,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_-]{8,200}$/;
const MAX_VARIABLES = 40;
const MAX_VALUE = 20_000;

export type SendTemplateInput = {
  templateCode: string;
  to: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
};

export type SendTemplateResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string; status: number };

export async function sendTemplateEmail(
  input: SendTemplateInput,
): Promise<SendTemplateResult> {
  const templateCode = input.templateCode.trim();
  const to = input.to.trim().toLowerCase();
  const variables = input.variables ?? {};
  const idempotencyKey = input.idempotencyKey?.trim();

  if (!TEMPLATE_CODE.test(templateCode)) {
    return { ok: false, error: "Template inválido.", status: 400 };
  }
  if (!EMAIL.test(to) || to.length > 320) {
    return { ok: false, error: "Destinatário inválido.", status: 400 };
  }
  if (idempotencyKey && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return { ok: false, error: "Chave de idempotência inválida.", status: 400 };
  }
  if (!variablesAreSafe(variables)) {
    return { ok: false, error: "Variáveis inválidas.", status: 400 };
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME");
  if (!url || !serviceKey || !apiKey || !senderEmail || !senderName) {
    return { ok: false, error: "Envio de e-mail sem configuração.", status: 500 };
  }

  const db = createClient(url, serviceKey);

  if (idempotencyKey) {
    const { data: existing } = await db
      .from("email_dispatch")
      .select("idempotency_key")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) return { ok: true, duplicate: true };
  }

  const { data: template, error: templateError } = await db
    .from("email_template")
    .select("subject, html, enabled")
    .eq("code", templateCode)
    .maybeSingle();

  if (templateError || !template || !template.enabled) {
    return { ok: false, error: "Template não encontrado.", status: 404 };
  }

  const subject = render(template.subject, variables, false).replace(/[\r\n]/g, " ").slice(0, 200);
  const html = render(template.html, variables, true);

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    return { ok: false, error: "Não foi possível enviar o e-mail.", status: 502 };
  }

  if (idempotencyKey) {
    await db.from("email_dispatch").insert({
      idempotency_key: idempotencyKey,
      template_code: templateCode,
      recipient: to,
    });
  }

  return { ok: true, duplicate: false };
}

function variablesAreSafe(variables: Record<string, string>) {
  const entries = Object.entries(variables);
  if (entries.length > MAX_VARIABLES) return false;
  return entries.every(([key, value]) =>
    /^[a-zA-Z0-9_]{1,40}$/.test(key) &&
    typeof value === "string" &&
    value.length <= MAX_VALUE
  );
}

function render(template: string, variables: Record<string, string>, escape: boolean) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) return match;
    const value = variables[key] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
