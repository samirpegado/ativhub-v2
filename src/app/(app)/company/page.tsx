import type { Metadata } from "next";
import { CompanyForm } from "@/components/company/company-form";
import { requireAdminPage } from "@/lib/auth/permissions";
import { loadCompanyProfile } from "@/lib/company/profile";

export const metadata: Metadata = {
  title: "Minha empresa",
};

export default async function CompanyPage() {
  const { tenantId } = await requireAdminPage();
  const company = await loadCompanyProfile();
  return <CompanyForm tenantId={tenantId} company={company} />;
}
