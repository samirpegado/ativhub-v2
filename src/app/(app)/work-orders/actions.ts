"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/permissions";
import { isBillingMode } from "@/lib/work-orders/billing";
import { ASSET_STATUSES } from "@/lib/assets/status";
import { emptyToNull } from "@/lib/address/format";
import { deleteError, mutationError, parseMoney, parseUuid } from "@/lib/forms/parse";
import type { MutationState } from "@/lib/forms/state";
import {
  isWorkOrderPriority,
  isWorkOrderStatus,
  statusTimestamps,
  type WorkOrderStatus,
} from "@/lib/work-orders/status";
import { parseTaskList, type WorkOrderTask } from "@/lib/work-orders/tasks";

function refreshOrders() {
  revalidatePath("/");
  revalidatePath("/profile");
}

function parseDateTime(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} inválida.`);
  return date.toISOString();
}

function parseDuration(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Duração inválida.");
  }
  return number;
}

function readIds(formData: FormData, name: string) {
  return [
    ...new Set(
      formData
        .getAll(name)
        .map((value) => parseUuid(value))
        .filter((value): value is string => Boolean(value)),
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
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Informe o título da ordem de serviço.");
  if (title.length > 200) {
    throw new Error("O título deve ter no máximo 200 caracteres.");
  }

  const status = String(formData.get("status") ?? "OPEN");
  const priority = String(formData.get("priority") ?? "NONE");
  if (!isWorkOrderStatus(status)) throw new Error("Status inválido.");
  if (!isWorkOrderPriority(priority)) throw new Error("Prioridade inválida.");

  const locationId = parseUuid(formData.get("location_id"));
  const assetId = parseUuid(formData.get("asset_id"));
  const teamId = parseUuid(formData.get("team_id"));
  const primaryUserId = parseUuid(formData.get("primary_user_id"));
  const billingMode = String(formData.get("billing_mode") ?? "NONE");
  if (!isBillingMode(billingMode)) throw new Error("Cobrança inválida.");

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
    title,
    description: emptyToNull(formData.get("description")),
    status,
    priority,
    due_date: parseDateTime(formData.get("due_date"), "Data de vencimento"),
    estimated_start_date: parseDateTime(
      formData.get("estimated_start_date"),
      "Data de início",
    ),
    estimated_duration: parseDuration(formData.get("estimated_duration")),
    required_signature: formData.get("required_signature") === "on",
    location_id: locationId,
    asset_id: assetId,
    team_id: teamId,
    primary_user_id: primaryUserId,
    billing_mode: billingMode,
    service_amount: billingMode === "FIXED" ? (parseMoney(formData.get("service_amount")) ?? 0) : null,
    assigneeIds: readIds(formData, "assignee_ids"),
    tasks: readTasks(formData),
    assetStatus: String(formData.get("asset_status") ?? ""),
  };
}

async function replaceLinks(
  supabase: Awaited<ReturnType<typeof requireArea>>["supabase"],
  tenantId: string,
  workOrderId: string,
  assigneeIds: string[],
  tasks: WorkOrderTask[],
) {
  if (assigneeIds.length > 0) {
    const { data, error } = await supabase
      .from("membership")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("enabled", true)
      .in("id", assigneeIds);
    if (error || (data ?? []).length !== assigneeIds.length) {
      throw new Error("Há responsáveis inválidos.");
    }
  }

  const { error: clearAssignees } = await supabase
    .from("work_order_assignee")
    .delete()
    .eq("work_order_id", workOrderId);
  if (clearAssignees) throw new Error("Não foi possível salvar os responsáveis.");

  if (assigneeIds.length > 0) {
    const { error } = await supabase.from("work_order_assignee").insert(
      assigneeIds.map((membershipId) => ({
        work_order_id: workOrderId,
        membership_id: membershipId,
      })),
    );
    if (error) throw new Error("Não foi possível salvar os responsáveis.");
  }

  const { error: clearTasks } = await supabase
    .from("task")
    .delete()
    .eq("work_order_id", workOrderId);
  if (clearTasks) throw new Error("Não foi possível salvar as tarefas.");

  if (tasks.length > 0) {
    const { error } = await supabase.from("task").insert(
      tasks.map((task, index) => ({
        tenant_id: tenantId,
        work_order_id: workOrderId,
        label: task.label,
        task_type: task.taskType,
        options: task.options,
        value: task.value ?? null,
        order_index: index,
      })),
    );
    if (error) throw new Error("Não foi possível salvar as tarefas.");
  }
}

export async function createWorkOrder(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId, appUser } = await requireArea("work_orders", "edit");

  try {
    const fields = await readFields(formData, supabase, tenantId);
    const { assigneeIds, tasks, assetStatus, status, ...columns } = fields;
    const stamps = statusTimestamps({
      next: status,
      previousStatus: "OPEN",
      firstTimeToReact: null,
      membershipId: appUser.membershipId,
    });

    const { data, error } = await supabase
      .from("work_order")
      .insert({
        tenant_id: tenantId,
        ...columns,
        status,
        created_by: appUser.membershipId,
        ...stamps,
      })
      .select("id")
      .single();

    if (error || !data) return { error: mutationError(error ?? {}) };

    try {
      await replaceLinks(supabase, tenantId, data.id, assigneeIds, tasks);
      if (
        columns.asset_id &&
        assetStatus &&
        ASSET_STATUSES.some((item) => item.value === assetStatus)
      ) {
        await supabase
          .from("asset")
          .update({ status: assetStatus })
          .eq("id", columns.asset_id);
      }
    } catch (linkError) {
      await supabase.from("work_order").delete().eq("id", data.id);
      throw linkError;
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a ordem de serviço.",
    };
  }

  refreshOrders();
  return { success: true };
}

export async function updateWorkOrder(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase, tenantId, appUser } = await requireArea("work_orders", "edit");

  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Ordem de serviço inválida.");
    const fields = await readFields(formData, supabase, tenantId);
    const { assigneeIds, tasks, assetStatus: _assetStatus, status, ...columns } =
      fields;

    const { data: current, error: loadError } = await supabase
      .from("work_order")
      .select("status, first_time_to_react")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (loadError || !current) {
      return { error: "Não foi possível atualizar a ordem de serviço." };
    }

    const previousStatus = isWorkOrderStatus(current.status)
      ? current.status
      : null;
    const stamps = statusTimestamps({
      next: status as WorkOrderStatus,
      previousStatus,
      firstTimeToReact: current.first_time_to_react,
      membershipId: appUser.membershipId,
    });

    const { error } = await supabase
      .from("work_order")
      .update({ ...columns, status, ...stamps })
      .eq("id", id);
    if (error) return { error: mutationError(error) };

    await replaceLinks(supabase, tenantId, id, assigneeIds, tasks);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a ordem de serviço.",
    };
  }

  refreshOrders();
  return { success: true };
}

export async function deleteWorkOrder(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const { supabase } = await requireArea("work_orders", "edit");

  try {
    const id = parseUuid(formData.get("id"));
    if (!id) throw new Error("Ordem de serviço inválida.");
    const { error } = await supabase.from("work_order").delete().eq("id", id);
    if (error) return { error: deleteError(error) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a ordem de serviço.",
    };
  }

  refreshOrders();
}
