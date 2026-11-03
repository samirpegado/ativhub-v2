import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import {
  consumeOtp,
  issueOtp,
  resolveSiteUrl,
  serviceClient,
  type OtpPurpose,
} from "../_shared/otp.ts";

type Body = {
  action?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  companyName?: string;
  termsAccepted?: boolean;
  siteUrl?: string;
  token?: string;
  code?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  const db = serviceClient();
  if (!db) return json({ error: "Função sem configuração." }, 500);

  const siteUrl = resolveSiteUrl(body.siteUrl);
  const email = String(body.email ?? "").trim().toLowerCase();

  switch (body.action) {
    case "register":
      return register(db, body, siteUrl);
    case "resend-verification":
      return resend(db, email, "VERIFY_EMAIL", siteUrl);
    case "confirm-email":
      return confirmEmail(db, body);
    case "request-reset":
      return resend(db, email, "RESET_PASSWORD", siteUrl);
    case "reset-password":
      return resetPassword(db, body);
    default:
      return json({ error: "Ação inválida." }, 400);
  }
});

async function register(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  body: Body,
  siteUrl: string,
) {
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const companyName = String(body.companyName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const phone = formatPhone(String(body.phone ?? ""));

  if (!body.termsAccepted) return json({ error: "Aceite os termos para criar a conta." }, 400);
  if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80) {
    return json({ error: "Informe nome e sobrenome." }, 400);
  }
  if (!companyName || companyName.length > 120) {
    return json({ error: "Informe o nome da empresa." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "E-mail inválido." }, 400);
  }
  if (password.length < 8 || password.length > 72) {
    return json({ error: "A senha deve ter entre 8 e 72 caracteres." }, 400);
  }
  if (!phone) return json({ error: "Telefone inválido." }, 400);

  const existing = await findUserByEmail(db, email);
  if (existing?.email_confirmed_at) {
    return json({ error: "Este e-mail já está em uso." }, 409);
  }

  let userId = existing?.id ?? null;
  let createdNow = false;
  if (existing && !existing.email_confirmed_at) {
    const updated = await db.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: {
        ...existing.user_metadata,
        first_name: firstName,
        last_name: lastName,
        phone,
        terms_accepted_at: new Date().toISOString(),
      },
    });
    if (updated.error) return json({ error: "Não foi possível criar a conta." }, 400);
  }
  if (!userId) {
    const created = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone,
        terms_accepted_at: new Date().toISOString(),
      },
    });
    userId = created.data.user?.id ?? null;
    createdNow = Boolean(userId);
    if (!userId) return json({ error: "Não foi possível criar a conta." }, 400);
  }

  const { error: provisionError } = await db.rpc("provision_owner_tenant", {
    p_user_id: userId,
    p_company_name: companyName,
    p_first_name: firstName,
    p_last_name: lastName,
    p_phone: phone,
  });

  if (provisionError && !/já tem uma empresa/i.test(provisionError.message)) {
    if (createdNow) await db.auth.admin.deleteUser(userId);
    return json({ error: "Não foi possível criar a empresa." }, 400);
  }

  const issued = await issueOtp(db, {
    userId,
    email,
    purpose: "VERIFY_EMAIL",
    name: firstName,
    siteUrl,
  });
  if (!issued.ok) return json({ error: issued.error }, issued.status);
  return json({ ok: true, sent: issued.sent });
}

async function resend(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  email: string,
  purpose: OtpPurpose,
  siteUrl: string,
) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "E-mail inválido." }, 400);
  }

  const user = await findUserByEmail(db, email);
  if (!user || (purpose === "VERIFY_EMAIL" && user.email_confirmed_at)) {
    return json({ ok: true, sent: true });
  }

  const meta = user.user_metadata ?? {};
  const name = String(meta.first_name ?? "").trim();
  const issued = await issueOtp(db, {
    userId: user.id,
    email,
    purpose,
    name,
    siteUrl,
  });
  if (!issued.ok) return json({ error: issued.error }, issued.status);
  return json({ ok: true, sent: issued.sent });
}

async function confirmEmail(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  body: Body,
) {
  const consumed = await consumeOtp(db, {
    purpose: "VERIFY_EMAIL",
    token: body.token,
    email: body.email,
    code: body.code,
  });
  if (!consumed.ok) return json({ error: consumed.error }, consumed.status);

  const { error } = await db.auth.admin.updateUserById(consumed.userId, {
    email_confirm: true,
  });
  if (error) return json({ error: "Não foi possível confirmar o e-mail." }, 500);
  return json({ ok: true });
}

async function resetPassword(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  body: Body,
) {
  const password = String(body.password ?? "");
  if (password.length < 8 || password.length > 72) {
    return json({ error: "A senha deve ter entre 8 e 72 caracteres." }, 400);
  }

  const consumed = await consumeOtp(db, {
    purpose: "RESET_PASSWORD",
    token: body.token,
    email: body.email,
    code: body.code,
  });
  if (!consumed.ok) return json({ error: consumed.error }, consumed.status);

  const { error } = await db.auth.admin.updateUserById(consumed.userId, {
    password,
    email_confirm: true,
  });
  if (error) return json({ error: "Não foi possível redefinir a senha." }, 500);
  return json({ ok: true });
}

async function findUserByEmail(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  email: string,
) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;

  const endpoint = new URL("/auth/v1/admin/users", url);
  endpoint.searchParams.set("filter", email);
  endpoint.searchParams.set("per_page", "20");

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { users?: User[] };
  return (
    payload.users?.find((user) => user.email?.toLowerCase() === email) ?? null
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length === 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
