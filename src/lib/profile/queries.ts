import { requireTenant } from "@/lib/auth/current-user";
import { signStoragePath } from "@/lib/storage/signed-url";

export type ProfileData = {
  membershipId: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  roleName: string;
  isAdmin: boolean;
  imageUrl: string | null;
  createdWorkOrders: number;
  completedWorkOrders: number;
};

export async function getProfile(): Promise<ProfileData> {
  const { supabase, user, tenantId } = await requireTenant();
  const { data, error } = await supabase
    .from("membership")
    .select("id, first_name, last_name, phone, job_title, image_url, role:role_id(code, name)")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Não foi possível carregar o perfil.");
  }

  const role = data.role as
    | { code: string; name: string }
    | { code: string; name: string }[]
    | null;
  const roleRecord = Array.isArray(role) ? role[0] : role;

  const [created, completed, imageUrl] = await Promise.all([
    supabase
      .from("work_order")
      .select("id", { count: "exact", head: true })
      .eq("created_by", data.id)
      .eq("archived", false),
    supabase
      .from("work_order")
      .select("id", { count: "exact", head: true })
      .eq("completed_by", data.id)
      .eq("archived", false),
    signStoragePath(supabase, data.image_url),
  ]);

  return {
    membershipId: data.id,
    tenantId,
    firstName: data.first_name,
    lastName: data.last_name,
    email: user.email ?? "",
    phone: data.phone,
    jobTitle: data.job_title,
    roleName: roleRecord?.name ?? "Usuário",
    isAdmin: roleRecord?.code === "ADMIN",
    imageUrl,
    createdWorkOrders: created.count ?? 0,
    completedWorkOrders: completed.count ?? 0,
  };
}
