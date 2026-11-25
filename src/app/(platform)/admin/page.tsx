import { redirect } from "next/navigation";
import { PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";

export default function PlatformAdminPage() {
  redirect(PLATFORM_TENANTS_PATH);
}
