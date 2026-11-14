import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestDetailView } from "@/components/requests/request-detail";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { loadRequestDetail } from "@/lib/requests/queries";

export const metadata: Metadata = {
  title: "Solicitação",
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { tenantId, appUser } = await requireArea("requests", "view", { redirect: true });
  const request = await loadRequestDetail(id);
  if (!request) notFound();

  return (
    <RequestDetailView
      request={request}
      tenantId={tenantId}
      canEdit={can(appUser, "requests", "edit")}
      isAdmin={appUser.isAdmin}
    />
  );
}
