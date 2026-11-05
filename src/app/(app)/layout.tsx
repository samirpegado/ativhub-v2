import { AppShell } from "@/components/layout/app-shell";
import { can } from "@/lib/auth/areas";
import { requireUser } from "@/lib/auth/current-user";
import { countPendingRequests } from "@/lib/requests/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const pendingRequestCount = can(user, "requests", "view") ? await countPendingRequests() : null;

  return <AppShell user={user} pendingRequestCount={pendingRequestCount}>{children}</AppShell>;
}
