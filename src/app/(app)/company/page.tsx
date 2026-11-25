import type { Metadata } from "next";
import { CompanyForm } from "@/components/company/company-form";
import { TenantActivity } from "@/components/layout/tenant-activity";
import { requireAdminPage } from "@/lib/auth/permissions";
import { loadCompanyProfile } from "@/lib/company/profile";

export const metadata: Metadata = {
  title: "Minha empresa",
};

export default async function CompanyPage() {
  const { tenantId, appUser } = await requireAdminPage();
  const company = await loadCompanyProfile();
  return (
    <TenantActivity user={appUser}>
      <CompanyForm tenantId={tenantId} company={company} />
    </TenantActivity>
  );
}
