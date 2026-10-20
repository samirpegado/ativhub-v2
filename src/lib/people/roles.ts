export const ASSIGNABLE_ROLES = [
  { code: "ADMIN" },
  { code: "TECHNICIAN" },
  { code: "REQUESTER" },
  { code: "VIEW_ONLY" },
] as const;

export type AssignableRoleCode = (typeof ASSIGNABLE_ROLES)[number]["code"];

export function isAssignableRole(code: string): code is AssignableRoleCode {
  return ASSIGNABLE_ROLES.some((role) => role.code === code);
}
