"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { emptyToNull } from "@/lib/address/format";
import { deleteError, mutationError, parseUuid } from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import { loadPreventiveDetail } from "@/lib/preventive/queries";
import { isRecurrenceBase, isRecurrenceType } from "@/lib/preventive/schedule";
import { isWorkOrderPriority } from "@/lib/work-orders/status";
import { parseTaskList, type WorkOrderTask } from "@/lib/work-orders/tasks";

function refresh() {
  revalidatePath("/preventive");
  revalidatePath("/");
}

function parseDay(value: FormDataEntryValue | null, label: string, required: boolean) {
  const text = String(value ?? "").trim();
  if (!text) {
    if (required) throw new Error(`Informe ${label}.`);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} inválida.`);
  return `${text}T12:00:00.000Z`;
}

function parseDelay(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0 || number > 3650) {
    throw new Error("O prazo de vencimento é inválido.");
  }
  return number;
}

function parseDuration(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) throw new Error("Duração inválida.");
  return number;
}

function readDays(formData: FormData) {
  return [
    ...new Set(
      String(formData.get("days_of_week") ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ];
}

function readTasks(formData: FormData): WorkOrderTask[] {
  const raw = String(formData.get("tasks_json") ?? "").trim();
  if (!raw) return [];
  try {
    return parseTaskList(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Tarefas inválidas.");
    throw error;
  }
}

async function readFields(
  formData: FormData,
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  tenantId: string,
) {
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!name) throw new Error("Informe o nome do agendamento.");
  if (!title) throw new Error("Informe o título da ordem.");
  if (name.length > 200 || title.length > 200) {
    throw new Error("O nome e o título devem ter no máximo 200 caracteres.");
  }

  const priority = String(formData.get("priority") ?? "NONE");
  const recurrenceBasedOn = String(formData.get("recurrence_based_on") ?? "");
  const recurrenceType = String(formData.get("recurrence_type") ?? "");
  if (!isWorkOrderPriority(priority)) throw new Error("Prioridade inválida.");
  if (!isRecurrenceBase(recurrenceBasedOn)) throw new Error("Base da recorrência inválida.");
  if (!isRecurrenceType(recurrenceType)) throw new Error("Tipo de recorrência inválido.");

  const frequency = Number(String(formData.get("frequency") ?? "").trim());
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 999) {
    throw new Error("A frequência deve ser um número maior que zero.");
  }

  const useWeekdays = recurrenceType === "WEEKLY" && recurrenceBasedOn === "SCHEDULED_DATE";
  const days = useWeekdays ? readDays(formData) : [];
  if (useWeekdays && days.length === 0) {
    throw new Error("Escolha pelo menos um dia da semana.");
  }

  const startsOn = parseDay(formData.get("starts_on"), "o início", true);
  const endsOn = parseDay(formData.get("ends_on"), "o fim", false);
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new Error("O fim precisa ser depois do início.");
  }

  const locationId = parseUuid(formData.get("location_id"));
  const assetId = parseUuid(formData.get("asset_id"));
  const teamId = parseUuid(formData.get("team_id"));
  const primaryUserId = parseUuid(formData.get("primary_user_id"));

  if (assetId) {
    const { data: asset } = await supabase
      .from("asset")
      .select("id, location_id")
      .eq("id", assetId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!asset) throw new Error("Ativo inválido.");
    if (locationId && asset.location_id && asset.location_id !== locationId) {
      throw new Error("O ativo não pertence à localização selecionada.");
    }
  }

  return {
    name,
    title,
    description: emptyToNull(formData.get("description")),
    priority,
    frequency,
    recurrence_type: recurrenceType,
    recurrence_based_on: recurrenceBasedOn,
    days_of_week: days.length > 0 ? days : null,
    starts_on: startsOn!,
    ends_on: endsOn,
    due_date_delay: parseDelay(formData.get("due_date_delay")),
    estimated_duration: parseDuration(formData.get("estimated_duration")),
    location_id: locationId,
    asset_id: assetId,
    team_id: teamId,
    primary_user_id: primaryUserId,
    tasks: readTasks(formData),
  };
}

async function replaceTasks(
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  tenantId: string,
  scheduleId: string,
  tasks: WorkOrderTask[],
) {
  const { error: clearError } = await supabase
    .from("pm_task_template")
    .delete()
    .eq("pm_id", scheduleId);
  if (clearError) throw new Error("Não foi possível salvar as tarefas.");
  if (tasks.length === 0) return;
  const { error } = await supabase.from("pm_task_template").insert(
    tasks.map((task, index) => ({
      tenant_id: tenantId,
      pm_id: scheduleId,
      label: task.label,
      task_type: task.taskType,
      options: task.options,
      order_index: index,
    })),
  );
  if (error) throw new Error("Não foi possível salvar as tarefas.");
}

async function syncSchedule(
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  scheduleId: string,
) {
  const { error: refreshError } = await supabase.rpc("refresh_preventive_schedule", {
    p_id: scheduleId,
  });
  if (refreshError) throw new Error("Não foi possível calcular a próxima ordem.");
  const { error } = await supabase.rpc("generate_due_preventive_work_orders");
  if (error) throw new Error("Não foi possível gerar a ordem.");
}

export async function createPreventive(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("preventive", "edit");
  try {
    const { tasks, ...columns } = await readFields(formData, supabase, tenantId);
    const { data, error } = await supabase
      .from("preventive_maintenance")
      .insert({ tenant_id: tenantId, ...columns })
      .select("id")
      .single();
    if (error || !data) return { error: error ? mutationError(error) : "Não foi possível criar o agendamento." };
    await replaceTasks(supabase, tenantId, data.id, tasks);
    await syncSchedule(supabase, data.id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível criar o agendamento.",
    };
  }
  refresh();
  return { success: true };
}

export async function updatePreventive(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId } = await requireArea("preventive", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Agendamento inválido.");
    const { tasks, ...columns } = await readFields(formData, supabase, tenantId);
    const { error } = await supabase.from("preventive_maintenance").update(columns).eq("id", id);
    if (error) return { error: mutationError(error) };
    await replaceTasks(supabase, tenantId, id, tasks);
    await syncSchedule(supabase, id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível atualizar o agendamento.",
    };
  }
  refresh();
  return { success: true };
}

export async function deletePreventive(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("preventive", "edit");
  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Agendamento inválido.");
    const { error } = await supabase.from("preventive_maintenance").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível excluir o agendamento.",
    };
  }
  refresh();
  return { success: true };
}

export async function setPreventivePaused(
  scheduleId: string,
  paused: boolean,
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireArea("preventive", "edit");
  try {
    const id = parseUuid(scheduleId);
    if (!id) throw new Error("Agendamento inválido.");
    const { error } = await supabase
      .from("preventive_maintenance")
      .update({ disabled: paused })
      .eq("id", id);
    if (error) throw new Error("Não foi possível atualizar o agendamento.");
    if (!paused) await syncSchedule(supabase, id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível atualizar o agendamento.",
    };
  }
  refresh();
  return { ok: true };
}

export async function fetchPreventiveDetail(scheduleId: string) {
  try {
    await requireArea("preventive", "view");
    const id = parseUuid(scheduleId);
    if (!id) throw new Error("Agendamento inválido.");
    return await loadPreventiveDetail(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível carregar o agendamento.",
    };
  }
}
