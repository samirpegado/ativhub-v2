"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/current-user";
import { emptyToNull } from "@/lib/address/format";
import type { MutationState } from "@/lib/forms/state";
import { formatPhone, phoneDigits } from "@/lib/phone/br";

const AVATAR_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function refreshProfile() {
  revalidatePath("/profile");
  revalidatePath("/", "layout");
}

export async function updateProfile(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, user, appUser } = await requireTenant();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phoneRaw = emptyToNull(formData.get("phone"));
  const digits = phoneDigits(phoneRaw);
  const phone = digits ? formatPhone(digits) : null;

  if (!firstName || !lastName) {
    return { error: "Informe nome e sobrenome." };
  }
  if (firstName.length > 80 || lastName.length > 80) {
    return { error: "Nome e sobrenome devem ter no máximo 80 caracteres." };
  }
  if (digits && digits.length !== 10 && digits.length !== 11) {
    return { error: "Telefone inválido." };
  }

  const { data: membership, error: loadError } = await supabase
    .from("membership")
    .select("id, role:role_id(code)")
    .eq("user_id", user.id)
    .eq("tenant_id", appUser.tenantId!)
    .eq("enabled", true)
    .maybeSingle();

  if (loadError || !membership) {
    return { error: "Não foi possível atualizar o perfil." };
  }

  const role = membership.role as
    | { code: string }
    | { code: string }[]
    | null;
  const roleCode = Array.isArray(role) ? role[0]?.code : role?.code;
  const isAdmin = roleCode === "ADMIN";

  const patch: {
    first_name: string;
    last_name: string;
    phone: string | null;
    job_title?: string | null;
  } = {
    first_name: firstName,
    last_name: lastName,
    phone,
  };

  if (isAdmin) {
    const jobTitle = emptyToNull(formData.get("job_title"));
    if (jobTitle && jobTitle.length > 80) {
      return { error: "Cargo deve ter no máximo 80 caracteres." };
    }
    patch.job_title = jobTitle;
  }

  const { error } = await supabase
    .from("membership")
    .update(patch)
    .eq("id", membership.id);

  if (error) {
    if (error.message.includes("only admins can change job_title")) {
      return { error: "Só um administrador pode alterar o cargo." };
    }
    return { error: "Não foi possível salvar os dados." };
  }

  refreshProfile();
  return { success: true };
}

export async function changePassword(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, user } = await requireTenant();
  const currentPassword = String(formData.get("current_password") ?? "");
  const nextPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !nextPassword || !confirmPassword) {
    return { error: "Preencha a senha atual e a nova senha." };
  }
  if (nextPassword.length < 8) {
    return { error: "A nova senha deve ter no mínimo 8 caracteres." };
  }
  if (nextPassword !== confirmPassword) {
    return { error: "A confirmação não confere com a nova senha." };
  }
  if (!user.email) {
    return { error: "Não foi possível alterar a senha." };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    return { error: "Senha atual incorreta." };
  }

  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) {
    return { error: "Não foi possível alterar a senha." };
  }

  return { success: true };
}

export async function setProfilePhoto(path: string): Promise<MutationState> {
  const { supabase, user, tenantId } = await requireTenant();
  const { data: membership } = await supabase
    .from("membership")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .maybeSingle();

  if (!membership) {
    return { error: "Não foi possível salvar a foto." };
  }

  const prefix = `${tenantId}/avatars/${membership.id}.`;
  const extension = path.startsWith(prefix) ? path.slice(prefix.length) : "";
  if (!AVATAR_EXTENSIONS.has(extension) || path.includes("..")) {
    return { error: "Arquivo de foto inválido." };
  }

  const { error } = await supabase
    .from("membership")
    .update({ image_url: path })
    .eq("id", membership.id);

  if (error) {
    return { error: "Não foi possível salvar a foto." };
  }

  refreshProfile();
  return { success: true };
}
