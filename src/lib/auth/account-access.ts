import { headers } from "next/headers";

export type AccountAccessResult = {
  ok: boolean;
  status: number;
  error?: string;
  sent?: boolean;
};

export async function callAccountAccess(
  body: Record<string, unknown>,
): Promise<AccountAccessResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, status: 500, error: "Aplicação sem configuração." };
  }

  const origin = (await headers()).get("origin");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || "http://localhost:3000";

  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/account-access`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: anon,
        authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ ...body, siteUrl }),
    });
  } catch {
    return { ok: false, status: 502, error: "Não foi possível concluir a solicitação." };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    sent?: boolean;
  };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload.error || "Não foi possível concluir a solicitação.",
    };
  }

  return { ok: true, status: response.status, sent: payload.sent };
}
