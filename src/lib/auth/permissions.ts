import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/current-user";
import { can, type MenuArea } from "@/lib/auth/areas";

const PATHS: { href: string; area: MenuArea }[] = [
  { href: "/", area: "work_orders" },
  { href: "/preventive", area: "preventive" },
  { href: "/requests", area: "requests" },
  { href: "/assets", area: "assets" },
  { href: "/locations", area: "locations" },
  { href: "/inventory", area: "inventory" },
  { href: "/parties", area: "parties" },
  { href: "/people", area: "people" },
];

export function firstAllowedPath(user: { isAdmin: boolean; areas: import("@/lib/auth/areas").AreaAccess }) {
  return PATHS.find((item) => can(user, item.area, "view"))?.href ?? "/profile";
}

export async function requireArea(
  area: MenuArea,
  mode: "view" | "edit",
  options?: { redirect?: boolean },
) {
  const context = await requireTenant();
  if (!can(context.appUser, area, mode)) {
    if (options?.redirect) redirect(firstAllowedPath(context.appUser));
    throw new Error("Você não tem permissão para esta ação.");
  }
  return context;
}

export async function requireAdmin() {
  const context = await requireTenant();
  if (!context.appUser.isAdmin) {
    throw new Error("Só um administrador pode fazer isso.");
  }
  return context;
}

export async function requireAdminPage() {
  const context = await requireTenant();
  if (!context.appUser.isAdmin) redirect(firstAllowedPath(context.appUser));
  return context;
}
