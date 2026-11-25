import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { PLATFORM_TENANTS_PATH } from "./paths";

export const requirePlatformOperator = cache(async function requirePlatformOperator() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(PLATFORM_TENANTS_PATH)}`);
  if (!user.email_confirmed_at) redirect("/auth/verify");

  const { data, error } = await supabase.rpc("platform_admin_status");
  if (error) throw new Error("Não foi possível verificar o acesso à administração da plataforma.");
  if (data !== true) notFound();

  return { supabase, user };
});
