"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { emptyToNull } from "@/lib/address/format";
import { deleteError, mutationError, parseUuid } from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import { isAssignableRole } from "@/lib/people/roles";
import { formatPhone, phoneDigits } from "@/lib/phone/br";

function refreshPeople() {
  revalidatePath("/people");
}

async function requireAdmin() {
  return requireArea("people", "edit");
}

function readPersonFields(formData: FormData, currentCode?: string) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const roleCode = String(formData.get("role_code") ?? "").trim();
  const phoneRaw = emptyToNull(formData.get("phone"));
  const digits = phoneDigits(phoneRaw);

  if (!firstName || !lastName) {
    throw new Error("Informe nome e sobrenome.");
  }
  if (firstName.length > 80 || lastName.length > 80) {
    throw new Error("Nome e sobrenome devem ter no máximo 80 caracteres.");
  }
  if (!isAssignableRole(roleCode) && roleCode !== currentCode) {
    throw new Error("Papel inválido.");
  }
  if (digits && digits.length !== 10 && digits.length !== 11) {
    throw new Error("Telefone inválido.");
  }

  return {
    firstName,
    lastName,
    roleCode,
    phone: digits ? formatPhone(digits) : null,
  };
}

async function invokeMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const payload = (await error.context.json()) as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      return "Não foi possível criar a pessoa.";
    }
  }
  return "Não foi possível criar a pessoa.";
}

export async function createPerson(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase } = await requireAdmin();
    const fields = readPersonFields(formData);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: "E-mail inválido." };
    }
    if (password.length < 8) {
      return { error: "A senha deve ter no mínimo 8 caracteres." };
    }

    const { data, error } = await supabase.functions.invoke("create-tenant-user", {
      body: {
        roleCode: fields.roleCode,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email,
        phone: fields.phone,
        password,
      },
    });

    if (error) return { error: await invokeMessage(error) };
    if (data && typeof data === "object" && "error" in data && data.error) {
      return { error: String(data.error) };
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a pessoa.",
    };
  }

  refreshPeople();
  return { success: true };
}

export async function updatePerson(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase, tenantId, appUser } = await requireAdmin();
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Pessoa inválida.");

    const { data: membership, error: loadError } = await supabase
      .from("membership")
      .select("id, is_owner, role:role_id(code)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (loadError || !membership) {
      return { error: "Não foi possível atualizar a pessoa." };
    }

    const currentRole = membership.role as
      | { code: string }
      | { code: string }[]
      | null;
    const currentCode = Array.isArray(currentRole)
      ? currentRole[0]?.code
      : currentRole?.code;
    const fields = readPersonFields(formData, currentCode);

    if (membership.is_owner && fields.roleCode !== "ADMIN") {
      return { error: "O dono da empresa permanece administrador." };
    }
    if (id === appUser.membershipId && fields.roleCode !== currentCode) {
      return { error: "Você não pode alterar o próprio papel." };
    }

    const { data: role, error: roleError } = await supabase
      .from("role")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("code", fields.roleCode)
      .maybeSingle();

    if (roleError || !role) return { error: "Papel inválido." };

    const { error } = await supabase
      .from("membership")
      .update({
        first_name: fields.firstName,
        last_name: fields.lastName,
        phone: fields.phone,
        role_id: role.id,
      })
      .eq("id", id);

    if (error) {
      if (error.message.includes("only admins can assign roles")) {
        return { error: "Só um administrador pode alterar o papel." };
      }
      return { error: mutationError(error) };
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a pessoa.",
    };
  }

  refreshPeople();
  return { success: true };
}

export async function deletePerson(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase, tenantId, appUser } = await requireAdmin();
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Pessoa inválida.");
    if (id === appUser.membershipId) {
      return { error: "Você não pode excluir a própria conta." };
    }

    const { data: membership } = await supabase
      .from("membership")
      .select("is_owner")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (membership?.is_owner) {
      return { error: "Não é possível excluir o dono da empresa." };
    }

    const { error } = await supabase.from("membership").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a pessoa.",
    };
  }

  refreshPeople();
}

function readTeamFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Informe o nome da equipe.");
  if (name.length > 80) {
    throw new Error("O nome da equipe deve ter no máximo 80 caracteres.");
  }

  const memberIds = formData
    .getAll("member_ids")
    .map((value) => parseUuid(value))
    .filter((value): value is string => Boolean(value));

  return {
    name,
    description: emptyToNull(formData.get("description")),
    memberIds: [...new Set(memberIds)],
  };
}

async function replaceMembers(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tenantId: string,
  teamId: string,
  memberIds: string[],
) {
  if (memberIds.length > 0) {
    const { data, error } = await supabase
      .from("membership")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("enabled", true)
      .in("id", memberIds);

    if (error || (data ?? []).length !== memberIds.length) {
      throw new Error("Há pessoas inválidas na equipe.");
    }
  }

  const { error: clearError } = await supabase
    .from("team_member")
    .delete()
    .eq("team_id", teamId);
  if (clearError) throw new Error("Não foi possível atualizar a equipe.");

  if (memberIds.length === 0) return;

  const { error } = await supabase.from("team_member").insert(
    memberIds.map((membershipId) => ({
      team_id: teamId,
      membership_id: membershipId,
    })),
  );
  if (error) throw new Error("Não foi possível atualizar a equipe.");
}

export async function createTeam(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase, tenantId } = await requireAdmin();
    const fields = readTeamFields(formData);
    const { data, error } = await supabase
      .from("team")
      .insert({
        tenant_id: tenantId,
        name: fields.name,
        description: fields.description,
      })
      .select("id")
      .single();

    if (error || !data) return { error: mutationError(error ?? {}) };
    try {
      await replaceMembers(supabase, tenantId, data.id, fields.memberIds);
    } catch (memberError) {
      await supabase.from("team").delete().eq("id", data.id);
      throw memberError;
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a equipe.",
    };
  }

  refreshPeople();
  return { success: true };
}

export async function updateTeam(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase, tenantId } = await requireAdmin();
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Equipe inválida.");
    const fields = readTeamFields(formData);
    const { error } = await supabase
      .from("team")
      .update({
        name: fields.name,
        description: fields.description,
      })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) return { error: mutationError(error) };
    await replaceMembers(supabase, tenantId, id, fields.memberIds);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a equipe.",
    };
  }

  refreshPeople();
  return { success: true };
}

export async function deleteTeam(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase } = await requireAdmin();
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Equipe inválida.");
    const { error } = await supabase.from("team").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a equipe.",
    };
  }

  refreshPeople();
}
