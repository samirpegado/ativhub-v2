"use server";

import { redirect } from "next/navigation";
import { callAccountAccess } from "@/lib/auth/account-access";
import type { AuthFormState } from "@/app/login/actions";

export async function confirmEmailCode(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const result = await callAccountAccess({
    action: "confirm-email",
    email,
    code: String(formData.get("code") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  redirect("/login?verified=1");
}

export async function resendVerification(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = await callAccountAccess({
    action: "resend-verification",
    email: String(formData.get("email") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  if (result.sent === false) {
    return { error: "Aguarde um minuto para pedir outro código." };
  }
  return { success: "Se a conta ainda não foi confirmada, enviamos outro código." };
}

export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password !== confirmation) {
    return { error: "As senhas não coincidem." };
  }

  const result = await callAccountAccess({
    action: "reset-password",
    token: String(formData.get("token") ?? ""),
    email: String(formData.get("email") ?? ""),
    code: String(formData.get("code") ?? ""),
    password,
  });
  if (!result.ok) return { error: result.error };
  redirect("/login?reset=1");
}
