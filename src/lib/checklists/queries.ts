import { requireTenant } from "@/lib/auth/current-user";
import { isTaskType, type WorkOrderTask } from "@/lib/work-orders/tasks";

export type ChecklistRecord = {
  id: string;
  name: string;
  tasks: WorkOrderTask[];
};

export async function listChecklists(): Promise<ChecklistRecord[]> {
  const { supabase } = await requireTenant();
  const [lists, tasks] = await Promise.all([
    supabase.from("checklist").select("id, name").order("name"),
    supabase
      .from("checklist_task")
      .select("checklist_id, label, task_type, options, order_index")
      .order("order_index"),
  ]);

  if (lists.error || tasks.error) {
    throw new Error("Não foi possível carregar as listas de verificação.");
  }

  return (lists.data ?? []).map((list) => ({
    id: list.id,
    name: list.name,
    tasks: (tasks.data ?? [])
      .filter((task) => task.checklist_id === list.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((task) => ({
        label: task.label,
        taskType: isTaskType(task.task_type) ? task.task_type : "SUBTASK",
        options: Array.isArray(task.options)
          ? task.options.filter((option): option is string => typeof option === "string")
          : [],
      })),
  }));
}
