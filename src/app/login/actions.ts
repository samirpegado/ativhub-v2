"use server";

import { redirect } from "next/navigation";
import { callAccountAccess } from "@/lib/auth/account-access";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; success?: string } | undefined;

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return { error: "Confirme o e-mail antes de entrar." };
    }
    return { error: "Credenciais incorretas fornecidas" };
  }

  const next = String(formData.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(safeNext);
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Informe o e-mail da conta." };
  }

  const result = await callAccountAccess({
    action: "request-reset",
    email,
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível enviar o e-mail de recuperação." };
  }
  if (result.sent === false) {
    return { error: "Aguarde um minuto para pedir outro link." };
  }

  return {
    success: "Se o e-mail existir, você receberá o link e um código para redefinir a senha.",
  };
}
