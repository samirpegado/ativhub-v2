export const PLATFORM_TENANTS_PATH = "/admin/tenants";

export function isPlatformPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
