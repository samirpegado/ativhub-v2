"use server";

import { redirect } from "next/navigation";
import { callAccountAccess } from "@/lib/auth/account-access";
import type { AuthFormState } from "@/app/login/actions";

export async function registerAccount(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = await callAccountAccess({
    action: "register",
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    termsAccepted: formData.get("terms") === "on",
  });

  if (!result.ok) return { error: result.error };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
}
