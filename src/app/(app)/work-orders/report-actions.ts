"use server";

import { requireArea } from "@/lib/auth/permissions";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendWorkOrderReport(workOrderId: string, to: string, recipientName: string) {
  const { supabase } = await requireArea("work_orders", "view");
  const email = to.trim().toLowerCase();
  const name = recipientName.trim();
  if (!EMAIL.test(email)) return { error: "Informe um e-mail válido." };
  if (name.length > 80) return { error: "O nome do destinatário é longo demais." };

  const { data, error } = await supabase.functions.invoke("send-work-order-report", {
    body: { workOrderId, to: email, recipientName: name || "cliente" },
  });
  if (error || (data && typeof data === "object" && "error" in data && data.error)) {
    return { error: "Não foi possível enviar o relatório." };
  }
  return { success: true as const };
}
