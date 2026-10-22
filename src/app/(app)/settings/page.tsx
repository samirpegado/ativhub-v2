import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { requireAdminPage } from "@/lib/auth/permissions";
import { areasFromPermissions, type AreaAccess } from "@/lib/auth/areas";
import { listChecklists } from "@/lib/checklists/queries";
import { ASSIGNABLE_ROLES } from "@/lib/people/roles";

export const metadata: Metadata = {
  title: "Configurações",
};

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  const [{ data, error }, checklists] = await Promise.all([
    supabase.from("role").select("id, code, name, description, permissions").order("name"),
    listChecklists(),
  ]);
  if (error) throw new Error("Não foi possível carregar as funções.");

  const order = ASSIGNABLE_ROLES.map((role) => role.code);
  const roles = (data ?? [])
    .filter((role) => order.includes(role.code as (typeof order)[number]))
    .sort((a, b) => order.indexOf(a.code as (typeof order)[number]) - order.indexOf(b.code as (typeof order)[number]))
    .map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? "",
      areas: areasFromPermissions(role.code, role.permissions, role.code === "ADMIN") satisfies AreaAccess,
    }));

  return <SettingsView roles={roles} checklists={checklists} />;
}
