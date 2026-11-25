export const PLATFORM_TENANTS_PATH = "/admin/tenants";
export const PLATFORM_SUPPORT_PATH = "/admin/support";

export function isPlatformPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
