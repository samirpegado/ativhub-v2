"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { parseTaskList, type WorkOrderTask } from "@/lib/work-orders/tasks";

type SaveChecklistResult =
  | { error: string }
  | { id: string; name: string; tasks: WorkOrderTask[] };

export async function saveChecklist(
  name: string,
  tasks: unknown,
): Promise<SaveChecklistResult> {
  const title = name.trim();
  if (!title) return { error: "Informe o nome da lista." };
  if (title.length > 80) return { error: "O nome da lista deve ter no máximo 80 caracteres." };

  let parsed;
  try {
    parsed = parseTaskList(tasks);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Tarefas inválidas." };
  }
  if (parsed.length === 0) return { error: "Adicione ao menos uma tarefa antes de salvar a lista." };

  const { supabase, tenantId } = await requireAdmin();
  const { data, error } = await supabase
    .from("checklist")
    .insert({ tenant_id: tenantId, name: title })
    .select("id, name")
    .single();

  if (error?.code === "23505") return { error: "Já existe uma lista com esse nome." };
  if (error || !data) return { error: "Não foi possível salvar a lista." };

  const { error: taskError } = await supabase.from("checklist_task").insert(
    parsed.map((task, index) => ({
      tenant_id: tenantId,
      checklist_id: data.id,
      label: task.label,
      task_type: task.taskType,
      options: task.options,
      order_index: index,
    })),
  );

  if (taskError) {
    await supabase.from("checklist").delete().eq("id", data.id);
    return { error: "Não foi possível salvar as tarefas da lista." };
  }

  revalidatePath("/");
  revalidatePath("/checklists");
  return { id: data.id, name: data.name, tasks: parsed };
}
