import type { ReactNode } from "react";
import type { AppUser } from "@/lib/auth/current-user";
import { TenantActivitySignal } from "./tenant-activity-signal";

export function TenantActivity({
  user,
  children,
}: {
  user: Pick<AppUser, "id" | "tenantId" | "membershipId">;
  children: ReactNode;
}) {
  return (
    <>
      {children}
      {user.tenantId && user.membershipId ? (
        <TenantActivitySignal userId={user.id} tenantId={user.tenantId} membershipId={user.membershipId} />
      ) : null}
    </>
  );
}
