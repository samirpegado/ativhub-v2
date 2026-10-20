import { createClient } from "@/lib/supabase/server";

export type DashboardStats = {
  open: number;
  inProgress: number;
  onHold: number;
  complete: number;
  overdue: number;
  total: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_order")
    .select("status, due_date")
    .eq("archived", false);

  const rows = data ?? [];
  const now = Date.now();

  return {
    open: rows.filter((row) => row.status === "OPEN").length,
    inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length,
    onHold: rows.filter((row) => row.status === "ON_HOLD").length,
    complete: rows.filter((row) => row.status === "COMPLETE").length,
    overdue: rows.filter(
      (row) =>
        row.status !== "COMPLETE" &&
        row.due_date !== null &&
        new Date(row.due_date).getTime() < now,
    ).length,
    total: rows.length,
  };
}
