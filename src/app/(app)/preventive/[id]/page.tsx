import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreventiveDetailView } from "@/components/preventive/preventive-detail";
import { can } from "@/lib/auth/areas";
import { requireArea } from "@/lib/auth/permissions";
import { loadPreventiveDetail, loadPreventiveEditor } from "@/lib/preventive/queries";

export const metadata: Metadata = {
  title: "Preventiva",
};

export default async function PreventiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { appUser } = await requireArea("preventive", "view", { redirect: true });
  const canEdit = can(appUser, "preventive", "edit");
  const detail = await loadPreventiveDetail(id).catch(() => null);
  if (!detail) notFound();
  const editor = canEdit ? await loadPreventiveEditor().catch(() => null) : null;

  return (
    <PreventiveDetailView
      schedule={detail.schedule}
      workOrders={detail.workOrders}
      canEdit={canEdit}
      editor={editor}
    />
  );
}
