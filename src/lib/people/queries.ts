import { can } from "@/lib/auth/areas";
import { requireTenant } from "@/lib/auth/current-user";
import { isAssignableRole } from "@/lib/people/roles";

export type RoleOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export type PersonRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  roleDescription: string;
  isOwner: boolean;
};

export type TeamRecord = {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
};

function roleOf(
  role:
    | { id: string; code: string; name: string; description: string | null }
    | { id: string; code: string; name: string; description: string | null }[]
    | null,
) {
  if (!role) return null;
  return Array.isArray(role) ? (role[0] ?? null) : role;
}

export async function listRoles() {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase
    .from("role")
    .select("id, code, name, description")
    .order("name");

  if (error) throw new Error("Não foi possível carregar os papéis.");

  const roles = (data ?? []).filter((role) => isAssignableRole(role.code));
  const order = ["ADMIN", "TECHNICIAN", "REQUESTER", "VIEW_ONLY"];
  return roles
    .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code))
    .map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? "",
    })) satisfies RoleOption[];
}

export async function listPeople() {
  const { supabase, tenantId, appUser } = await requireTenant();
  const { data, error } = await supabase
    .from("membership")
    .select(
      "id, first_name, last_name, email, phone, is_owner, role_id, role:role_id(id, code, name, description)",
    )
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .order("first_name");

  if (error) throw new Error("Não foi possível carregar as pessoas.");

  const people = (data ?? []).map((row) => {
    const role = roleOf(row.role);
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email ?? "",
      phone: row.phone,
      roleId: row.role_id,
      roleCode: role?.code ?? "",
      roleName: role?.name ?? "Usuário",
      roleDescription: role?.description ?? "",
      isOwner: row.is_owner,
    } satisfies PersonRecord;
  });

  return {
    people,
    canManage: can(appUser, "people", "edit"),
  };
}

export async function listTeams() {
  const { supabase } = await requireTenant();
  const [{ data: teams, error: teamError }, { data: links, error: linkError }] =
    await Promise.all([
      supabase.from("team").select("id, name, description").order("name"),
      supabase.from("team_member").select("team_id, membership_id"),
    ]);

  if (teamError || linkError) {
    throw new Error("Não foi possível carregar as equipes.");
  }

  return (teams ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    memberIds: (links ?? [])
      .filter((link) => link.team_id === team.id)
      .map((link) => link.membership_id),
  })) satisfies TeamRecord[];
}
