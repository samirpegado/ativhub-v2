"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { syncAssetDowntime } from "@/lib/assets/downtime";
import { ASSET_STATUSES } from "@/lib/assets/status";
import { parseUuid } from "@/lib/forms/parse";
import type { WorkOrderActivity } from "@/lib/work-orders/activity";
import { loadWorkOrderDetail, type WorkOrderRecord } from "@/lib/work-orders/queries";
import { canExecuteWorkOrder } from "@/lib/work-orders/access";
import { isWorkOrderStatus, statusTimestamps, type WorkOrderStatus } from "@/lib/work-orders/status";
import {
  INSPECTION_ANSWERS,
  SUBTASK_DONE,
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
  revalidatePath("/work-orders");
  revalidatePath("/inventory");
  revalidatePath("/assets");
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

async function ownedOrder(workOrderId: string, mode: "view" | "edit" | "execute" = "edit") {
  const context = await requireArea("work_orders", mode === "edit" ? "edit" : "view");
  if (!context.appUser.membershipId) {
    throw new Error("Usuário sem vínculo com a empresa.");
  }
  const id = parseUuid(workOrderId);
  if (!id) throw new Error("Ordem inválida.");
  if (mode === "execute") {
    const { data: order, error } = await context.supabase
      .from("work_order")
      .select("primary_user_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !order) throw new Error("Ordem não encontrada.");
    const { data: links, error: linkError } = await context.supabase
      .from("work_order_assignee")
      .select("membership_id")
      .eq("work_order_id", id);
    if (linkError) throw new Error("Ordem não encontrada.");
    const allowed = canExecuteWorkOrder(context.appUser, {
      primaryUserId: order.primary_user_id,
      assigneeIds: (links ?? []).map((link) => link.membership_id),
    });
    if (!allowed) throw new Error("Esta ordem não está atribuída a você.");
  }
  return { ...context, workOrderId: id, membershipId: context.appUser.membershipId };
}

async function moveWorkOrderStatus(
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  tenantId: string,
  membershipId: string,
  workOrderId: string,
  next: WorkOrderStatus,
) {
  const { data: current, error: readError } = await supabase
    .from("work_order")
    .select("status, first_time_to_react")
    .eq("id", workOrderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (readError || !current || !isWorkOrderStatus(current.status)) return;
  if (current.status === "COMPLETE" || current.status === next) return;
  await supabase
    .from("work_order")
    .update({
      status: next,
      ...statusTimestamps({
        next,
        previousStatus: current.status,
        firstTimeToReact: current.first_time_to_react,
        membershipId,
      }),
    })
    .eq("id", workOrderId);
}

export async function loadWorkOrderActivity(workOrderId: string): Promise<ActivityResult> {
  try {
    const { workOrderId: id } = await ownedOrder(workOrderId, "execute");
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
  assetStatus?: { status: string; at: string } | null,
): Promise<{ error: string } | { status: string }> {
  try {
    const { supabase, tenantId, membershipId, workOrderId: id } = await ownedOrder(workOrderId);
    if (!isWorkOrderStatus(status)) throw new Error("Status inválido.");
    const { data: current, error: readError } = await supabase
      .from("work_order")
      .select("status, first_time_to_react, asset_id")
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

    if (assetStatus && current.asset_id) {
      if (!ASSET_STATUSES.some((item) => item.value === assetStatus.status)) {
        throw new Error("Status do ativo inválido.");
      }
      const { data: asset, error: assetReadError } = await supabase
        .from("asset")
        .select("status")
        .eq("id", current.asset_id)
        .maybeSingle();
      if (assetReadError || !asset) throw new Error("Ativo inválido.");
      const { error: assetError } = await supabase
        .from("asset")
        .update({ status: assetStatus.status })
        .eq("id", current.asset_id);
      if (assetError) throw new Error("Não foi possível atualizar o status do ativo.");
      await syncAssetDowntime(supabase, {
        tenantId,
        assetId: current.asset_id,
        previous: asset.status,
        next: assetStatus.status,
        at: assetStatus.at,
        workOrderId: id,
      });
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível atualizar o status.",
    };
  }

  refresh();
  return { status };
}

export async function completeWorkOrder(workOrderId: string): Promise<ActivityResult> {
  try {
    const { supabase, tenantId, membershipId, appUser, workOrderId: id } = await ownedOrder(
      workOrderId,
      "execute",
    );
    const manages = appUser.isAdmin || appUser.areas.work_orders.edit;
    if (!manages) {
      const { data: labors, error: laborError } = await supabase
        .from("labor")
        .select("duration_seconds, started_at")
        .eq("work_order_id", id);
      if (laborError) throw new Error("Não foi possível concluir a ordem.");
      const hasTime = (labors ?? []).some(
        (labor) => labor.duration_seconds > 0 || Boolean(labor.started_at),
      );
      if (!hasTime) throw new Error("Registre um tempo antes de concluir a ordem.");

      const { data: tasks, error: taskError } = await supabase
        .from("task")
        .select("executed_at")
        .eq("work_order_id", id);
      if (taskError) throw new Error("Não foi possível concluir a ordem.");
      if ((tasks ?? []).some((task) => !task.executed_at)) {
        throw new Error("Conclua todas as tarefas antes de encerrar a ordem.");
      }
    }

    const { data: current, error: readError } = await supabase
      .from("work_order")
      .select("status, first_time_to_react")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (readError || !current || !isWorkOrderStatus(current.status)) {
      throw new Error("Ordem não encontrada.");
    }
    const { error } = await supabase
      .from("work_order")
      .update({
        status: "COMPLETE",
        ...statusTimestamps({
          next: "COMPLETE",
          previousStatus: current.status,
          firstTimeToReact: current.first_time_to_react,
          membershipId,
        }),
      })
      .eq("id", id);
    if (error) throw new Error("Não foi possível concluir a ordem.");
    refresh();
    const detail = await loadWorkOrderDetail(id);
    return { activity: detail.activity, order: detail.order, logoUrl: detail.logoUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível concluir a ordem.",
    };
  }
}

export async function toggleWorkOrderTimer(workOrderId: string): Promise<ActivityResult> {
  try {
    const { supabase, tenantId, membershipId, workOrderId: id } = await ownedOrder(workOrderId, "execute");
    const { data: current, error: readError } = await supabase
      .from("labor")
      .select("id, duration_seconds, started_at, tracked_at, hourly_rate")
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
        tracked_at: now,
        hourly_rate: await membershipRate(supabase, membershipId),
      });
      if (error) throw new Error("Não foi possível iniciar o temporizador.");
      await moveWorkOrderStatus(supabase, tenantId, membershipId, id, "IN_PROGRESS");
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
          tracked_at: current.tracked_at ?? current.started_at,
          hourly_rate: current.hourly_rate ?? (await membershipRate(supabase, membershipId)),
        })
        .eq("id", current.id);
      if (error) throw new Error("Não foi possível parar o temporizador.");
      await moveWorkOrderStatus(supabase, tenantId, membershipId, id, "ON_HOLD");
    } else {
      const { error } = await supabase
        .from("labor")
        .update({ started_at: now })
        .eq("id", current.id);
      if (error) throw new Error("Não foi possível iniciar o temporizador.");
      await moveWorkOrderStatus(supabase, tenantId, membershipId, id, "IN_PROGRESS");
    }

    refresh();
    const detail = await loadWorkOrderDetail(id);
    return { activity: detail.activity, order: detail.order, logoUrl: detail.logoUrl };
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
    const { supabase, tenantId, membershipId, workOrderId: id } = await ownedOrder(workOrderId, "execute");
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
    await moveWorkOrderStatus(supabase, tenantId, membershipId, id, "IN_PROGRESS");
    refresh();
    const detail = await loadWorkOrderDetail(id);
    return { activity: detail.activity, order: detail.order, logoUrl: detail.logoUrl };
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
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId, "execute");
    const labor = parseUuid(laborId);
    if (!labor) throw new Error("Tempo inválido.");
    const { error } = await supabase
      .from("labor")
      .delete()
      .eq("id", labor)
      .eq("work_order_id", id);
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
    const { supabase, tenantId, workOrderId: id } = await ownedOrder(workOrderId, "execute");
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
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId, "execute");
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

export async function executeWorkOrderTask(
  workOrderId: string,
  taskId: string,
  input: { value: string; comment: string },
): Promise<ActivityResult> {
  try {
    const { supabase, membershipId, workOrderId: id } = await ownedOrder(workOrderId, "execute");
    const taskKey = parseUuid(taskId);
    if (!taskKey) throw new Error("Tarefa inválida.");

    const { data: task, error: readError } = await supabase
      .from("task")
      .select("id, task_type, options")
      .eq("id", taskKey)
      .eq("work_order_id", id)
      .maybeSingle();
    if (readError || !task || !isTaskType(task.task_type)) {
      throw new Error("Tarefa não encontrada.");
    }

    const text = input.value.trim();
    const comment = input.comment.trim();
    if (text.length > 500) throw new Error("A resposta da tarefa é longa demais.");
    if (comment.length > 500) throw new Error("O comentário deve ter no máximo 500 caracteres.");

    if (!text) {
      const { error } = await supabase
        .from("task")
        .update({ value: null, comment: null, executed_at: null, membership_id: null })
        .eq("id", task.id)
        .eq("work_order_id", id);
      if (error) throw new Error("Não foi possível salvar a tarefa.");
    } else {
      const options = Array.isArray(task.options)
        ? task.options.filter((option): option is string => typeof option === "string")
        : [];
      const allowed =
        task.task_type === "SUBTASK"
          ? text === SUBTASK_DONE || text === "COMPLETE"
          : task.task_type === "INSPECTION"
            ? INSPECTION_ANSWERS.some((item) => item.value === text)
            : task.task_type === "MULTIPLE"
              ? options.includes(text)
              : task.task_type === "NUMBER"
                ? /^-?\d+([.,]\d+)?$/.test(text)
                : true;
      if (!allowed) throw new Error("Resposta inválida para esta tarefa.");

      const { error } = await supabase
        .from("task")
        .update({
          value: text,
          comment: comment || null,
          executed_at: new Date().toISOString(),
          membership_id: membershipId,
        })
        .eq("id", task.id)
        .eq("work_order_id", id);
      if (error) throw new Error("Não foi possível salvar a tarefa.");
    }

    refresh();
    const detail = await loadWorkOrderDetail(id);
    return { activity: detail.activity, order: detail.order, logoUrl: detail.logoUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar a tarefa.",
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
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId, "execute");
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
    const { supabase, workOrderId: id } = await ownedOrder(workOrderId, "execute");
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
