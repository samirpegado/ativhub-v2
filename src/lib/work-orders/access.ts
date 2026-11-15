import type { AreaAccess } from "@/lib/auth/areas";

export function canExecuteWorkOrder(
  user: {
    isAdmin: boolean;
    roleCode: string;
    membershipId: string | null;
    areas: AreaAccess;
  },
  order: { primaryUserId: string | null; assigneeIds: string[] },
) {
  const technician = user.roleCode === "TECHNICIAN" && !user.isAdmin;
  if (technician) {
    return Boolean(user.membershipId && order.assigneeIds.includes(user.membershipId));
  }
  if (user.isAdmin || user.areas.work_orders.edit) return true;
  if (!user.membershipId || !user.areas.work_orders.view) return false;
  return (
    order.assigneeIds.includes(user.membershipId) || order.primaryUserId === user.membershipId
  );
}
