import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signStoragePath } from "@/lib/storage/signed-url";

export type AppUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  imageUrl: string | null;
  tenantId: string | null;
  tenantName: string | null;
  membershipId: string | null;
  roleName: string;
  initials: string;
};

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser(): Promise<AppUser> {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  let query = supabase
    .from("membership")
    .select(
      "id, first_name, last_name, image_url, job_title, role:role_id(code, name), tenant:tenant_id(id, name)",
    )
    .eq("user_id", user.id)
    .eq("enabled", true);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: rows } = await query.limit(1);
  const membership = rows?.[0];
  const tenant = membership?.tenant;
  const tenantRecord = Array.isArray(tenant) ? tenant[0] : tenant;
  const role = membership?.role as
    | { code: string; name: string }
    | { code: string; name: string }[]
    | null
    | undefined;
  const roleRecord = Array.isArray(role) ? role[0] : role;
  const resolvedTenantId = tenantId ?? tenantRecord?.id ?? null;
  const tenantName = tenantRecord?.name ?? null;
  const roleName = membership?.job_title || roleRecord?.name || "Usuário";

  const firstName = membership?.first_name ?? "";
  const lastName = membership?.last_name ?? "";
  const email = user.email ?? "";
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || email || "Usuário";
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.trim().toUpperCase() ||
    email.charAt(0).toUpperCase() ||
    "U";

  return {
    id: user.id,
    email,
    firstName,
    lastName,
    displayName,
    imageUrl: await signStoragePath(supabase, membership?.image_url ?? null),
    tenantId: resolvedTenantId,
    tenantName,
    membershipId: membership?.id ?? null,
    roleName,
    initials,
  };
}

export async function requireTenant() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const appUser = await requireUser();
  if (!appUser.tenantId) {
    throw new Error("Usuário sem tenant ativo.");
  }

  return { supabase, user, tenantId: appUser.tenantId, appUser };
}
