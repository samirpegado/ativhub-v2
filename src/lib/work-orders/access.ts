import type { AreaAccess } from "@/lib/auth/areas";

export function canExecuteWorkOrder(
  user: { isAdmin: boolean; membershipId: string | null; areas: AreaAccess },
  order: { primaryUserId: string | null; assigneeIds: string[] },
) {
  if (user.isAdmin || user.areas.work_orders.edit) return true;
  if (!user.membershipId || !user.areas.work_orders.view) return false;
  return (
    order.assigneeIds.includes(user.membershipId) || order.primaryUserId === user.membershipId
  );
}
