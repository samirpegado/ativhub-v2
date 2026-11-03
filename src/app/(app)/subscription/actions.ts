"use server";

import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/current-user";

export async function startCheckout(formData: FormData) {
  const { supabase, appUser } = await requireTenant({ allowExpired: true });
  if (!appUser.isAdmin) redirect("/subscription?error=1");

  const planId = String(formData.get("planId") ?? "");
  const { data, error } = await supabase.functions.invoke("asaas-create-checkout", {
    body: { planId },
  });

  const url = typeof data?.url === "string" ? data.url : "";
  if (error || !url) redirect("/subscription?error=1");

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    redirect("/subscription?error=1");
  }
  if (target.protocol !== "https:" || !target.hostname.endsWith("asaas.com")) {
    redirect("/subscription?error=1");
  }

  redirect(url);
}
