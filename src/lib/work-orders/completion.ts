import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export const WORK_ORDER_COMPLETE_NEEDS_LABOR =
  "Registre um tempo de mão de obra antes de concluir a ordem.";
export const WORK_ORDER_COMPLETE_NEEDS_TASKS =
  "Execute todas as tarefas antes de concluir a ordem.";

export function workOrderCompleteBlock(input: {
  labors: { durationSeconds: number; startedAt: string | null }[];
  tasks: { executedAt?: string | null }[];
}) {
  const missing: string[] = [];
  const hasTime = input.labors.some(
    (labor) => labor.durationSeconds > 0 || Boolean(labor.startedAt),
  );
  if (!hasTime) missing.push(WORK_ORDER_COMPLETE_NEEDS_LABOR);
  if (input.tasks.some((task) => !task.executedAt)) missing.push(WORK_ORDER_COMPLETE_NEEDS_TASKS);
  return missing.length > 0 ? missing.join(" ") : null;
}

export async function workOrderCompletionBlock(supabase: Client, workOrderId: string) {
  const { data: labors, error: laborError } = await supabase
    .from("labor")
    .select("duration_seconds, started_at")
    .eq("work_order_id", workOrderId);
  if (laborError) return "Não foi possível concluir a ordem.";

  const { data: tasks, error: taskError } = await supabase
    .from("task")
    .select("executed_at")
    .eq("work_order_id", workOrderId);
  if (taskError) return "Não foi possível concluir a ordem.";

  return workOrderCompleteBlock({
    labors: (labors ?? []).map((labor) => ({
      durationSeconds: labor.duration_seconds,
      startedAt: labor.started_at,
    })),
    tasks: (tasks ?? []).map((task) => ({ executedAt: task.executed_at })),
  });
}
