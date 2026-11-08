import type { Metadata } from "next";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { TechDashboard } from "@/components/dashboard/tech-dashboard";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { loadMaintenanceOverview } from "@/lib/dashboard/load";
import { parseTechRange } from "@/lib/dashboard/overview";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { appUser } = await requireArea("work_orders", "view", { redirect: true });
  const canEdit = can(appUser, "work_orders", "edit");
  const range = parseTechRange((await searchParams).range);
  const overview = await loadMaintenanceOverview(canEdit ? null : appUser.membershipId, range);

  if (!canEdit) {
    return <TechDashboard data={overview} firstName={appUser.firstName} range={range} />;
  }

  return <AdminDashboard data={overview} range={range} />;
}
