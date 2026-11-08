import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkOrderDetail } from "@/components/work-orders/work-order-detail";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { loadWorkOrderDetail, loadWorkOrderEditor } from "@/lib/work-orders/queries";

export const metadata: Metadata = {
  title: "Ordem de serviço",
};

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { tenantId, appUser } = await requireArea("work_orders", "view", { redirect: true });
  const canEdit = can(appUser, "work_orders", "edit");
  const detail = await loadWorkOrderDetail(id).catch(() => null);
  if (!detail) notFound();
  const editor = canEdit ? await loadWorkOrderEditor(id).catch(() => null) : null;

  return (
    <WorkOrderDetail
      order={detail.order}
      activity={detail.activity}
      logoUrl={detail.logoUrl}
      tenantId={tenantId}
      canEdit={canEdit}
      editor={editor}
    />
  );
}
