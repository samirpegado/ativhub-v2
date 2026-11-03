import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendTemplateEmail } from "./email.ts";

export type OtpPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

const HOUR_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const TTL_MS = 3 * HOUR_MS;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

type OtpRow = {
  id: string;
  user_id: string;
  email: string;
  purpose: OtpPurpose;
  code_hash: string;
  attempts: number;
  expires_at: string;
};

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export function resolveSiteUrl(requested: string | undefined) {
  const configured = Deno.env.get("APP_URL")?.replace(/\/$/, "");
  const candidate = requested?.trim().replace(/\/$/, "");
  const allowed = new Set([
    "https://ativhub.sgapps.org",
    "http://localhost:3000",
    ...(configured ? [configured] : []),
  ]);
  if (candidate && allowed.has(candidate)) return candidate;
  return configured ?? "https://ativhub.sgapps.org";
}

export async function issueOtp(
  db: SupabaseClient,
  input: {
    userId: string;
    email: string;
    purpose: OtpPurpose;
    name: string;
    siteUrl: string;
  },
) {
  const email = input.email.trim().toLowerCase();
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { data: recent } = await db
    .from("adm_otp_emails")
    .select("created_at")
    .eq("user_id", input.userId)
    .eq("purpose", input.purpose)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_PER_HOUR);

  const newest = recent?.[0]?.created_at;
  if (newest && Date.now() - new Date(newest).getTime() < MIN_INTERVAL_MS) {
    return { ok: true as const, sent: false };
  }
  if ((recent?.length ?? 0) >= MAX_PER_HOUR) {
    return { ok: true as const, sent: false };
  }

  const token = randomToken();
  const code = randomCode();
  const tokenHash = await sha256(token);
  const codeHash = await sha256(`${input.purpose}:${email}:${code}`);
  const now = new Date().toISOString();

  await db
    .from("adm_otp_emails")
    .update({ consumed_at: now })
    .eq("user_id", input.userId)
    .eq("purpose", input.purpose)
    .is("consumed_at", null);

  const { data: inserted, error } = await db
    .from("adm_otp_emails")
    .insert({
      user_id: input.userId,
      email,
      purpose: input.purpose,
      token_hash: tokenHash,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + TTL_MS).toISOString(),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false as const, error: "Não foi possível gerar o código.", status: 500 };
  }

  const path = input.purpose === "VERIFY_EMAIL" ? "/auth/activate" : "/auth/reset";
  const link = `${input.siteUrl}${path}?token=${encodeURIComponent(token)}`;
  const sent = await sendTemplateEmail({
    templateCode: input.purpose === "VERIFY_EMAIL" ? "ACCOUNT_VERIFICATION" : "PASSWORD_RESET",
    to: email,
    variables: {
      name: input.name || "usuário",
      link,
      code,
    },
    idempotencyKey: `otp:${inserted.id}`,
  });

  if (!sent.ok) {
    await db.from("adm_otp_emails").update({ consumed_at: now }).eq("id", inserted.id);
    return { ok: false as const, error: sent.error, status: sent.status };
  }

  return { ok: true as const, sent: true };
}

export async function consumeOtp(
  db: SupabaseClient,
  input: {
    purpose: OtpPurpose;
    token?: string;
    email?: string;
    code?: string;
  },
) {
  const token = input.token?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const code = input.code?.trim() ?? "";

  if (token) {
    if (token.length < 20 || token.length > 200) {
      return { ok: false as const, error: "Link inválido ou expirado.", status: 400 };
    }
    const tokenHash = await sha256(token);
    const { data } = await db
      .from("adm_otp_emails")
      .select("id, user_id, email, purpose, code_hash, attempts, expires_at")
      .eq("token_hash", tokenHash)
      .eq("purpose", input.purpose)
      .is("consumed_at", null)
      .maybeSingle();
    return finish(db, data as OtpRow | null);
  }

  if (!email || !/^\d{6}$/.test(code)) {
    return { ok: false as const, error: "Informe o e-mail e o código de 6 dígitos.", status: 400 };
  }

  const { data } = await db
    .from("adm_otp_emails")
    .select("id, user_id, email, purpose, code_hash, attempts, expires_at")
    .eq("email", email)
    .eq("purpose", input.purpose)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as OtpRow | null;
  if (!row) {
    return { ok: false as const, error: "Código inválido ou expirado.", status: 400 };
  }
  if (row.attempts >= MAX_ATTEMPTS || new Date(row.expires_at).getTime() <= Date.now()) {
    await db.from("adm_otp_emails").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false as const, error: "Código inválido ou expirado.", status: 400 };
  }

  const expected = await sha256(`${input.purpose}:${email}:${code}`);
  if (expected !== row.code_hash) {
    const attempts = row.attempts + 1;
    await db
      .from("adm_otp_emails")
      .update({
        attempts,
        consumed_at: attempts >= MAX_ATTEMPTS ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    return { ok: false as const, error: "Código inválido ou expirado.", status: 400 };
  }

  return finish(db, row);
}

async function finish(db: SupabaseClient, row: OtpRow | null) {
  if (!row || row.attempts >= MAX_ATTEMPTS || new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, error: "Link inválido ou expirado.", status: 400 };
  }

  const { data: consumed } = await db
    .from("adm_otp_emails")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (!consumed) {
    return { ok: false as const, error: "Link inválido ou expirado.", status: 400 };
  }

  return { ok: true as const, userId: row.user_id };
}

function randomCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = new DataView(bytes.buffer).getUint32(0) % 1_000_000;
  return value.toString().padStart(6, "0");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
