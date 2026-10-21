"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/current-user";
import { deleteError, mutationError, parseUuid } from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import { parseTaskList } from "@/lib/work-orders/tasks";

function refresh() {
  revalidatePath("/checklists");
  revalidatePath("/");
}

function readFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Informe o nome da lista.");
  if (name.length > 80) {
    throw new Error("O nome da lista deve ter no máximo 80 caracteres.");
  }

  const raw = String(formData.get("tasks_json") ?? "").trim();
  let tasks;
  try {
    tasks = parseTaskList(raw ? JSON.parse(raw) : []);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Tarefas inválidas.");
    throw error;
  }
  if (tasks.length === 0) {
    throw new Error("Adicione ao menos uma tarefa.");
  }

  return { name, tasks };
}

async function replaceTasks(
  supabase: Awaited<ReturnType<typeof requireTenant>>["supabase"],
  tenantId: string,
  checklistId: string,
  tasks: ReturnType<typeof readFields>["tasks"],
) {
  const { data: current, error: currentError } = await supabase
    .from("checklist_task")
    .select("id")
    .eq("checklist_id", checklistId);
  if (currentError) throw new Error("Não foi possível salvar as tarefas da lista.");

  const { error: insertError } = await supabase.from("checklist_task").insert(
    tasks.map((task, index) => ({
      tenant_id: tenantId,
      checklist_id: checklistId,
      label: task.label,
      task_type: task.taskType,
      options: task.options,
      order_index: index,
    })),
  );
  if (insertError) throw new Error("Não foi possível salvar as tarefas da lista.");

  const previousIds = (current ?? []).map((task) => task.id);
  if (previousIds.length === 0) return;

  const { error: clearError } = await supabase
    .from("checklist_task")
    .delete()
    .in("id", previousIds);
  if (clearError) throw new Error("Não foi possível salvar as tarefas da lista.");
}

export async function createChecklist(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase, tenantId } = await requireTenant();
    const fields = readFields(formData);
    const { data, error } = await supabase
      .from("checklist")
      .insert({ tenant_id: tenantId, name: fields.name })
      .select("id")
      .single();
    if (error?.code === "23505") return { error: "Já existe uma lista com esse nome." };
    if (error || !data) return { error: mutationError(error ?? {}) };

    try {
      await replaceTasks(supabase, tenantId, data.id, fields.tasks);
    } catch (error) {
      await supabase.from("checklist").delete().eq("id", data.id);
      throw error;
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar a lista.",
    };
  }

  refresh();
  return { success: true };
}

export async function updateChecklist(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase, tenantId } = await requireTenant();
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Lista inválida.");
    const fields = readFields(formData);

    const { error } = await supabase
      .from("checklist")
      .update({ name: fields.name })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error?.code === "23505") return { error: "Já existe uma lista com esse nome." };
    if (error) return { error: mutationError(error) };

    await replaceTasks(supabase, tenantId, id, fields.tasks);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar a lista.",
    };
  }

  refresh();
  return { success: true };
}

export async function deleteChecklist(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  try {
    const { supabase, tenantId } = await requireTenant();
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Lista inválida.");

    const { error } = await supabase
      .from("checklist")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível excluir a lista.",
    };
  }

  refresh();
  return { success: true };
}
