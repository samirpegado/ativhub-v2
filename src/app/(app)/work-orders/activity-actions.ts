"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { parseUuid } from "@/lib/forms/parse";
import type { WorkOrderActivity } from "@/lib/work-orders/activity";
import { loadWorkOrderDetail, type WorkOrderRecord } from "@/lib/work-orders/queries";
import { isWorkOrderStatus, statusTimestamps } from "@/lib/work-orders/status";
import {
  INSPECTION_ANSWERS,
  SUBTASK_ANSWERS,
  isTaskType,
} from "@/lib/work-orders/tasks";

type ActivityResult =
  | { error: string }
  | { activity: WorkOrderActivity; order?: WorkOrderRecord; logoUrl?: string | null };

async function readActivity(workOrderId: string): Promise<WorkOrderActivity> {
  return (await loadWorkOrderDetail(workOrderId)).activity;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/inventory");
}

async function membershipRate(
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  membershipId: string,
) {
  const { data } = await supabase
    .from("membership")
    .select("rate")
    .eq("id", membershipId)
    .maybeSingle();
  return data?.rate ?? null;
}

async function ownedOrder(workOrderId: string, mode: "view" | "edit" = "edit") {
  const context = await requireArea("work_orders", mode);
  if (!context.appUser.membershipId) {
    throw new Error("Usuário sem vínculo com a empresa.");
  }
  const id = parseUuid(workOrderId);
  if (!id) throw new Error("Ordem inválida.");
  return { ...context, workOrderId: id, membershipId: context.appUser.membershipId };
}

export async function loadWorkOrderActivity(workOrderId: string): Promise<ActivityResult> {
  try {
    const { workOrderId: id } = await ownedOrder(workOrderId, "view");
    const detail = await loadWorkOrderDetail(id);
    return { activity: detail.activity, order: detail.order, logoUrl: detail.logoUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível carregar a ordem.",
    };
  }
}

export async function setWorkOrderStatus(
  workOrderId: string,
  status: string,
): Promise<{ error: string } | { status: string }> {
  try {
    const { supabase, tenantId, membershipId, workOrderId: id } = await ownedOrder(workOrderId);
    if (!isWorkOrderStatus(status)) throw new Error("Status inválido.");
    const { data: current, error: readError } = await supabase
      .from("work_order")
      .select("status, first_time_to_react")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (readError || !current) throw new Error("Ordem não encontrada.");
    if (!isWorkOrderStatus(current.status)) throw new Error("Status inválido.");

    const { error } = await supabase
      .from("work_order")
      .update({
        status,
        ...statusTimestamps({
          next: status,
          previousStatus: current.status,
          firstTimeToReact: current.first_time_to_react,
          membershipId,
        }),
      })
      .eq("id", id);
    if (error) throw new Error("Não foi possível atualizar o status.");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível atualizar o status.",
    };
  }

  refresh();
  return { status };
}

export async function toggleWorkOrderTimer(workOrderId: string): Promise<ActivityResult> {
  try {
    const { supabase, tenantId, membershipId, workOrderId: id } = await ownedOrder(workOrderId);
    const { data: current, error: readError } = await supabase
      .from("labor")
      .select("id, duration_seconds, started_at, hourly_rate")
      .eq("work_order_id", id)
      .eq("membership_id", membershipId)
      .eq("logged", true)
      .maybeSingle();
    if (readError) throw new Error("Não foi possível atualizar o temporizador.");

    const now = new Date().toISOString();
    if (!current) {
      const { error } = await supabase.from("labor").insert({
        tenant_id: tenantId,
        work_order_id: id,
        membership_id: membershipId,
        logged: true,
        duration_seconds: 0,
        started_at: now,
        hourly_rate: await membershipRate(supabase, membershipId),
      });
      if (error) throw new Error("Não foi possível iniciar o temporizador.");
    } else if (current.started_at) {
      const extra = Math.max(
        0,
        Math.floor((Date.now() - new Date(current.started_at).getTime()) / 1000),
      );
      const { error } = await supabase
        .from("labor")
        .update({
          duration_seconds: current.duration_seconds + extra,
          started_at: null,
          hourly_rate: current.hourly_rate ?? (await membershipRate(supabase, membershipId)),
        })
        .eq("id", current.id);
      if (error) throw new Error("Não foi possível parar o temporizador.");
    } else {
      const { error } = await supabase
        .from("labor")
        .update({ started_at: now })
        .eq("id", current.id);
      if (error) throw new Error("Não foi possível iniciar o temporizador.");
    }

    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível atualizar o temporizador.",
    };
  }
}

export async function addWorkOrderLabor(
  workOrderId: string,
  workedOn: string,
  hours: number,
  minutes: number,
): Promise<ActivityResult> {
  try {
    const { supabase, tenantId, membershipId, workOrderId: id } = await ownedOrder(workOrderId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workedOn)) throw new Error("Informe a data.");
    if (!Number.isInteger(hours) || hours < 0 || hours > 999) {
      throw new Error("Horas inválidas.");
    }
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      throw new Error("Minutos inválidos.");
    }
    const duration = hours * 3600 + minutes * 60;
    if (duration <= 0) throw new Error("Informe a duração.");

    const { error } = await supabase.from("labor").insert({
      tenant_id: tenantId,
      work_order_id: id,
      membership_id: membershipId,
      logged: false,
      duration_seconds: duration,
      started_at: `${workedOn}T12:00:00.000Z`,
      hourly_rate: await membershipRate(supabase, membershipId),
    });
    if (error) throw new Error("Não foi possível adicionar o tempo.");
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível adicionar o tempo.",
    };
  }
}

export async function deleteWorkOrderLabor(
  workOrderId: string,
  laborId: string,
): Promise<ActivityResult> {
  try {
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId);
    const labor = parseUuid(laborId);
    if (!labor) throw new Error("Tempo inválido.");
    const { error } = await supabase
      .from("labor")
      .delete()
      .eq("id", labor)
      .eq("work_order_id", id)
      .eq("logged", false);
    if (error) throw new Error("Não foi possível remover o tempo.");
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível remover o tempo.",
    };
  }
}

const FILE_EXT = "pdf|png|jpe?g|webp|txt|docx?|xlsx?";

export async function registerWorkOrderFile(
  workOrderId: string,
  path: string,
  name: string,
): Promise<ActivityResult> {
  try {
    const { supabase, tenantId, workOrderId: id } = await ownedOrder(workOrderId);
    const fileName = name.trim().slice(0, 180);
    if (!fileName) throw new Error("Arquivo inválido.");
    const pattern = new RegExp(
      `^${tenantId}/work-orders/${id}/[0-9a-f-]{36}\\.(${FILE_EXT})$`,
      "i",
    );
    if (!pattern.test(path)) throw new Error("Arquivo inválido.");

    const { error } = await supabase.from("file").insert({
      tenant_id: tenantId,
      name: fileName,
      url: path,
      entity_type: "WORK_ORDER",
      entity_id: id,
    });
    if (error) throw new Error("Não foi possível salvar o arquivo.");
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar o arquivo.",
    };
  }
}

export async function deleteWorkOrderFile(
  workOrderId: string,
  fileId: string,
): Promise<ActivityResult> {
  try {
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId);
    const file = parseUuid(fileId);
    if (!file) throw new Error("Arquivo inválido.");
    const { data, error: readError } = await supabase
      .from("file")
      .select("id, url")
      .eq("id", file)
      .eq("entity_id", id)
      .eq("entity_type", "WORK_ORDER")
      .maybeSingle();
    if (readError || !data) throw new Error("Arquivo não encontrado.");

    await supabase.storage.from("attachments").remove([data.url]);
    const { error } = await supabase.from("file").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível remover o arquivo.");
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível remover o arquivo.",
    };
  }
}

export async function saveWorkOrderTaskAnswers(
  workOrderId: string,
  answers: { id: string; value: string }[],
): Promise<{ error: string } | { ok: true }> {
  try {
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId);
    if (answers.length === 0) return { ok: true };
    const ids = answers.map((answer) => parseUuid(answer.id)).filter((item): item is string => Boolean(item));
    if (ids.length !== answers.length) throw new Error("Tarefa inválida.");

    const { data, error: readError } = await supabase
      .from("task")
      .select("id, task_type, options")
      .eq("work_order_id", id)
      .in("id", ids);
    if (readError || (data ?? []).length !== ids.length) {
      throw new Error("Tarefa não encontrada.");
    }

    for (const answer of answers) {
      const task = data?.find((item) => item.id === answer.id);
      if (!task || !isTaskType(task.task_type)) throw new Error("Tarefa não encontrada.");
      const text = answer.value.trim();
      if (text.length > 500) throw new Error("A resposta da tarefa é longa demais.");
      if (!text) continue;
      const options = Array.isArray(task.options)
        ? task.options.filter((option): option is string => typeof option === "string")
        : [];
      const allowed =
        task.task_type === "SUBTASK"
          ? SUBTASK_ANSWERS.some((item) => item.value === text)
          : task.task_type === "INSPECTION"
            ? INSPECTION_ANSWERS.some((item) => item.value === text)
            : task.task_type === "MULTIPLE"
              ? options.includes(text)
              : task.task_type === "NUMBER"
                ? /^-?\d+([.,]\d+)?$/.test(text)
                : true;
      if (!allowed) throw new Error("Resposta inválida para esta tarefa.");
    }

    for (const answer of answers) {
      const { error } = await supabase
        .from("task")
        .update({ value: answer.value.trim() || null })
        .eq("id", answer.id)
        .eq("work_order_id", id);
      if (error) throw new Error("Não foi possível salvar as tarefas.");
    }

    refresh();
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar as tarefas.",
    };
  }
}

export async function addWorkOrderUpdate(
  workOrderId: string,
  body: string,
): Promise<ActivityResult> {
  try {
    const { supabase, tenantId, membershipId, workOrderId: id } = await ownedOrder(workOrderId);
    const text = body.trim();
    if (!text) throw new Error("Escreva o que foi feito.");
    if (text.length > 2000) throw new Error("A atualização deve ter no máximo 2000 caracteres.");

    const { error } = await supabase.from("work_order_update").insert({
      tenant_id: tenantId,
      work_order_id: id,
      membership_id: membershipId,
      body: text,
    });
    if (error) throw new Error("Não foi possível registrar a atualização.");
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível registrar a atualização.",
    };
  }
}

function parsePartQuantity(value: string) {
  const raw = value.trim().replace(",", ".");
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Informe a quantidade.");
  }
  return Math.round(amount * 1000) / 1000;
}

function stockError(error: { message: string }, fallback: string) {
  const message = error.message;
  if (
    message.includes("Estoque insuficiente") ||
    message.includes("Quantidade inválida") ||
    message.includes("Peça não encontrada") ||
    message.includes("Ordem não encontrada")
  ) {
    return message.replace(/^ERROR:\s*/i, "").split("\n")[0];
  }
  return fallback;
}

export async function addWorkOrderPart(
  workOrderId: string,
  partId: string,
  quantity: string,
): Promise<ActivityResult> {
  try {
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId);
    const part = parseUuid(partId);
    if (!part) throw new Error("Selecione a peça.");
    const { error } = await supabase.rpc("consume_work_order_part", {
      p_work_order_id: id,
      p_part_id: part,
      p_quantity: parsePartQuantity(quantity),
    });
    if (error) throw new Error(stockError(error, "Não foi possível adicionar a peça."));
    refresh();
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível adicionar a peça.",
    };
  }
}

export async function removeWorkOrderPart(
  workOrderId: string,
  lineId: string,
): Promise<ActivityResult> {
  try {
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId);
    const line = parseUuid(lineId);
    if (!line) throw new Error("Peça inválida.");
    const { error } = await supabase.rpc("return_work_order_part", {
      p_work_order_id: id,
      p_line_id: line,
    });
    if (error) throw new Error(stockError(error, "Não foi possível remover a peça."));
    refresh();
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível remover a peça.",
    };
  }
}

export async function deleteWorkOrderUpdate(
  workOrderId: string,
  updateId: string,
): Promise<ActivityResult> {
  try {
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId);
    const update = parseUuid(updateId);
    if (!update) throw new Error("Atualização inválida.");
    const { error } = await supabase
      .from("work_order_update")
      .delete()
      .eq("id", update)
      .eq("work_order_id", id);
    if (error) throw new Error("Não foi possível excluir a atualização.");
    return { activity: await readActivity(id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível excluir a atualização.",
    };
  }
}
