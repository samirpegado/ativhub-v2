import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ASSIGNABLE_ROLES = new Set([
  "ADMIN",
  "TECHNICIAN",
  "REQUESTER",
  "VIEW_ONLY",
]);

type CreateBody = {
  roleCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhone(value: string) {
  const digits = phoneDigits(value);
  if (!digits) return null;
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length === 10) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function roleCodeOf(role: { code: string } | { code: string }[] | null) {
  if (!role) return null;
  return Array.isArray(role) ? role[0]?.code : role.code;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Método inválido." }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return json({ error: "Função sem configuração." }, 500);
  }

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: "Não autenticado." }, 401);

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return json({ error: "Usuário sem empresa." }, 403);

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const roleCode = String(body.roleCode ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  const phone = phoneRaw ? formatPhone(phoneRaw) : null;

  if (!firstName || !lastName) {
    return json({ error: "Informe nome e sobrenome." }, 400);
  }
  if (firstName.length > 80 || lastName.length > 80) {
    return json({ error: "Nome e sobrenome devem ter no máximo 80 caracteres." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "E-mail inválido." }, 400);
  }
  if (password.length < 8 || password.length > 72) {
    return json({ error: "A senha deve ter entre 8 e 72 caracteres." }, 400);
  }
  if (phoneRaw && !phone) {
    return json({ error: "Telefone inválido." }, 400);
  }
  if (!ASSIGNABLE_ROLES.has(roleCode)) {
    return json({ error: "Papel inválido." }, 400);
  }

  const admin = createClient(url, serviceKey);
  const { data: caller } = await admin
    .from("membership")
    .select("role:role_id(code)")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .maybeSingle();

  if (
    roleCodeOf(
      (caller?.role ?? null) as { code: string } | { code: string }[] | null,
    ) !== "ADMIN"
  ) {
    return json({ error: "Só um administrador pode cadastrar pessoas." }, 403);
  }

  const { data: role } = await admin
    .from("role")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("code", roleCode)
    .maybeSingle();

  if (!role) return json({ error: "Papel inválido." }, 400);

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId },
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  let userId = created.data.user?.id ?? null;
  if (!userId) {
    const already = /already|registered|exists/i.test(created.error?.message ?? "");
    if (!already) {
      return json({ error: "Não foi possível criar o usuário." }, 400);
    }
    userId = await findUserId(url, serviceKey, email);
    if (!userId) {
      return json({ error: "Este e-mail já está em uso." }, 409);
    }

    const existingUser = await admin.auth.admin.getUserById(userId);
    const metadata = existingUser.data.user?.app_metadata ?? {};
    if (!metadata.tenant_id) {
      const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: { ...metadata, tenant_id: tenantId },
      });
      if (metadataError) {
        return json({ error: "Não foi possível vincular a pessoa à empresa." }, 400);
      }
    }
  }

  const { data: existingMembership } = await admin
    .from("membership")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembership) {
    return json({ error: "Esta pessoa já faz parte da empresa." }, 409);
  }

  const { error: insertError } = await admin.from("membership").insert({
    tenant_id: tenantId,
    user_id: userId,
    role_id: role.id,
    first_name: firstName,
    last_name: lastName,
    phone,
    email,
    enabled: true,
  });

  if (insertError) {
    return json({ error: "Não foi possível vincular a pessoa à empresa." }, 400);
  }

  return json({ success: true });
});

async function findUserId(url: string, serviceKey: string, email: string) {
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

  const payload = (await response.json()) as {
    users?: { id: string; email?: string | null }[];
  };
  const match = payload.users?.find(
    (item) => item.email?.toLowerCase() === email,
  );
  return match?.id ?? null;
}
