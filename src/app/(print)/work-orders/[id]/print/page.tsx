import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkOrderPrintDocument } from "@/components/work-orders/work-order-print-document";
import { WorkOrderPrintSheet } from "@/components/work-orders/work-order-print-sheet";
import { loadWorkOrderPrint } from "@/lib/work-orders/print";

export const metadata: Metadata = {
  title: "Impressão da ordem de serviço",
};

export default async function WorkOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await loadWorkOrderPrint(id);
  if (!data) notFound();

  return (
    <WorkOrderPrintSheet workOrderId={id}>
      <WorkOrderPrintDocument data={data} />
    </WorkOrderPrintSheet>
  );
}
