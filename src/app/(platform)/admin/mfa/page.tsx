import { redirect } from "next/navigation";
import { PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";

export default function FormerPlatformMfaPage() {
  redirect(PLATFORM_TENANTS_PATH);
}
