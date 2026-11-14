"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Flag, Package, Trash2, Users, Wrench } from "lucide-react";
import { deletePreventive, setPreventivePaused } from "@/app/(app)/preventive/actions";
import { TablePagination } from "@/components/lists/table-pagination";
import { Button } from "@/components/ui/button";
import type { MutationState } from "@/lib/forms/state";
import { PREVENTIVE_PAGE_SIZE, preventiveDetailHref } from "@/lib/preventive/asset-page";
import type { PreventiveLinkedAsset, PreventiveRecord, PreventiveWorkOrder } from "@/lib/preventive/queries";
import {
  formatScheduleDate,
  nextRunLabel,
  recurrenceBaseLabel,
  scheduleDescription,
} from "@/lib/preventive/schedule";
import { INSPECTION_ANSWERS, taskTypeLabel } from "@/lib/work-orders/tasks";
import {
  workOrderPriorityLabel,
  workOrderStatusColor,
  workOrderStatusLabel,
} from "@/lib/work-orders/status";

const whiteButton = "h-11 rounded-[10px] border border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white";

export function PreventiveDetailView({
  schedule: initialSchedule,
  assets,
  assetTotal,
  assetPage,
  workOrders,
  workOrderTotal,
  workOrderPage,
  canEdit,
}: {
  schedule: PreventiveRecord;
  assets: PreventiveLinkedAsset[];
  assetTotal: number;
  assetPage: number;
  workOrders: PreventiveWorkOrder[];
  workOrderTotal: number;
  workOrderPage: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeState, remove, removing] = useActionState<MutationState, FormData>(deletePreventive, undefined);
  const [, startRefresh] = useTransition();
  const [paging, startPaging] = useTransition();

  useEffect(() => {
    setSchedule(initialSchedule);
  }, [initialSchedule]);

  useEffect(() => {
    if (removeState?.success) router.push("/preventive");
    else if (removeState?.error) setError(removeState.error);
  }, [removeState, router]);

  const due =
    schedule.dueDateDelay === null
      ? "No mesmo dia"
      : `${schedule.dueDateDelay} dia${schedule.dueDateDelay === 1 ? "" : "s"} depois`;

  async function togglePause() {
    setBusy(true);
    const result = await setPreventivePaused(schedule.id, !schedule.disabled);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setSchedule((current) => ({ ...current, disabled: !current.disabled }));
    startRefresh(() => router.refresh());
  }

  function removeSchedule() {
    if (!window.confirm(`Excluir o agendamento ${schedule.name}? As ordens já criadas permanecem.`)) return;
    const data = new FormData();
    data.set("id", schedule.id);
    startRefresh(() => remove(data));
  }

  return (
    <div className="space-y-6 text-[#14233a]">
      <div className="flex flex-col gap-3.5">
        <Link href="/preventive" className="inline-flex items-center gap-2 self-start font-medium text-[#4a5a70]">
          <ArrowLeft className="size-[18px]" />
          Voltar para a preventiva
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm text-[#4a5a70]">{schedule.customId ?? "Agendamento"}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(schedule.priority)}`}>
                <Flag className="size-3.5" />
                Prioridade {workOrderPriorityLabel(schedule.priority).toLowerCase()}
              </span>
              {schedule.disabled ? (
                <span className="rounded-full bg-[#f5f7fb] px-2.5 py-1 text-xs font-semibold text-[#4a5a70]">Pausado</span>
              ) : null}
            </div>
            <h1 className="mt-2.5 text-[32px] leading-tight font-semibold tracking-tight">{schedule.name}</h1>
            <p className="mt-1.5 text-base text-[#4a5a70]">{scheduleDescription(schedule)}</p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2.5">
              <Button type="button" variant="outline" className={whiteButton} disabled={busy} onClick={togglePause}>
                {schedule.disabled ? "Retomar" : "Pausar"}
              </Button>
              <Button type="button" variant="outline" className={`${whiteButton} text-[#b42323]`} disabled={removing} onClick={removeSchedule}>
                <Trash2 /> Excluir
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-[#b42323]">{error}</p> : null}

      <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Recorrência">
        <h2 className="text-lg font-semibold tracking-tight">Recorrência</h2>
        <p className="text-[13px] text-[#4a5a70]">{recurrenceBaseLabel(schedule.recurrenceBasedOn)}</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Stat label="Começa em" value={formatScheduleDate(schedule.startsOn)} />
          <Stat label="Termina em" value={formatScheduleDate(schedule.endsOn)} />
          <Stat label="Próxima ordem" value={nextRunLabel(schedule)} />
          <Stat label="Vencimento" value={due} />
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2] basis-[560px] flex-col gap-5">
          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Tarefas">
            <div className="mb-[18px] flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Tarefas</h2>
                <p className="text-[13px] text-[#4a5a70]">Copiadas para cada ordem gerada</p>
              </div>
              <span className="rounded-full bg-[#f5f7fb] px-2.5 py-1 text-xs font-semibold text-[#4a5a70]">
                {schedule.tasks.length}
              </span>
            </div>
            {schedule.tasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#cbd5e1] px-4 py-5 text-sm text-[#4a5a70]">Este agendamento não tem tarefas.</p>
            ) : (
              <ol>
                {schedule.tasks.map((task, index) => {
                  const choices = task.taskType === "INSPECTION"
                    ? INSPECTION_ANSWERS.map((item) => item.label)
                    : task.taskType === "MULTIPLE"
                      ? task.options
                      : [];
                  return (
                    <li key={`${task.taskType}-${task.label}`} className="flex gap-3.5">
                      <div className="flex w-7 flex-none flex-col items-center">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[#eef3fb] text-xs font-bold text-[#0b1b33]">{index + 1}</span>
                        {index < schedule.tasks.length - 1 ? <span className="w-0.5 flex-1 bg-[#cbd5e1]" /> : null}
                      </div>
                      <div className={`min-w-0 flex-1 ${index < schedule.tasks.length - 1 ? "pb-5" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold">{task.label}</span>
                          <span className="rounded-full bg-[#f5f7fb] px-2 py-0.5 text-xs font-semibold text-[#4a5a70]">{taskTypeLabel(task.taskType)}</span>
                        </div>
                        {choices.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {choices.map((choice) => (
                              <span key={choice} className="rounded-md border border-[#e9edf3] bg-[#f5f7fb] px-2 py-1 text-xs text-[#14233a]">{choice}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-[#4a5a70]">{taskPrompt(task.taskType)}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Ativos">
            <div className="mb-[18px] flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Ativos</h2>
                <p className="text-[13px] text-[#4a5a70]">Cada ativo gera a própria ordem</p>
              </div>
              <span className="rounded-full bg-[#f5f7fb] px-2.5 py-1 text-xs font-semibold text-[#4a5a70]">{assetTotal}</span>
            </div>
            {assets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#cbd5e1] px-4 py-5 text-sm text-[#4a5a70]">Este agendamento não tem ativos.</p>
            ) : (
              <ul className="divide-y divide-[#e9edf3]">
                {assets.map((asset) => (
                  <li key={asset.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#eef3fb] text-[#0b1b33]">
                      <Package className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <Link href={`/assets/${asset.id}`} className="text-[15px] font-semibold hover:underline">
                        {asset.customId ? `${asset.customId} · ${asset.name}` : asset.name}
                      </Link>
                      {asset.locationName ? <p className="text-sm text-[#4a5a70]">{asset.locationName}</p> : null}
                      {asset.customerName ? <p className="text-sm text-[#4a5a70]">{asset.customerName}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {assetTotal > PREVENTIVE_PAGE_SIZE ? (
              <div className="-mx-4 mt-2">
                <TablePagination
                  page={assetPage}
                  pageSize={PREVENTIVE_PAGE_SIZE}
                  total={assetTotal}
                  pending={paging}
                  buttonClassName="border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white"
                  onPageChange={(page) => {
                    startPaging(() => {
                      router.push(preventiveDetailHref(schedule.id, { assets: page, orders: workOrderPage }), { scroll: false });
                    });
                  }}
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Ordens geradas">
            <div className="mb-[18px] flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Ordens geradas</h2>
                <p className="text-[13px] text-[#4a5a70]">As mais recentes deste agendamento</p>
              </div>
              <span className="rounded-full bg-[#f5f7fb] px-2.5 py-1 text-xs font-semibold text-[#4a5a70]">{workOrderTotal}</span>
            </div>
            {workOrders.length === 0 ? (
              <p className="text-sm text-[#4a5a70]">Nenhuma ordem gerada ainda.</p>
            ) : (
              <ul className="divide-y divide-[#e9edf3]">
                {workOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/work-orders/${order.id}`} className="flex items-center justify-between gap-3 py-3">
                      <span>
                        <span className="font-mono text-sm text-[#4a5a70]">{order.customId ?? "Ordem"}</span>
                        <span className="mt-0.5 block font-semibold">{order.title}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2 text-sm">
                        <span className="size-2.5 rounded-full" style={{ background: workOrderStatusColor(order.status) }} />
                        {workOrderStatusLabel(order.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {workOrderTotal > PREVENTIVE_PAGE_SIZE ? (
              <div className="-mx-4 mt-2">
                <TablePagination
                  page={workOrderPage}
                  pageSize={PREVENTIVE_PAGE_SIZE}
                  total={workOrderTotal}
                  pending={paging}
                  buttonClassName="border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white"
                  onPageChange={(page) => {
                    startPaging(() => {
                      router.push(preventiveDetailHref(schedule.id, { assets: assetPage, orders: page }), { scroll: false });
                    });
                  }}
                />
              </div>
            ) : null}
          </section>
        </div>

        <section className="min-w-0 flex-1 basis-[320px] rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Ordem que será criada">
          <h2 className="text-lg font-semibold">Ordem que será criada</h2>
          <Info icon={<Wrench className="size-[18px]" />} label="Título" value={schedule.title} />
          {schedule.description ? <p className="mt-2 text-sm text-[#4a5a70]">{schedule.description}</p> : null}
          <Info icon={<Users className="size-[18px]" />} label="Equipe" value={schedule.teamName ?? "—"} />
          <Info icon={<Users className="size-[18px]" />} label="Responsáveis" value={schedule.assigneeNames ?? "—"} />
          <Info
            icon={<CalendarClock className="size-[18px]" />}
            label="Duração estimada"
            value={schedule.estimatedDuration === null ? "—" : `${schedule.estimatedDuration} h`}
            last
          />
        </section>
      </div>

    </div>
  );
}

function taskPrompt(taskType: string) {
  if (taskType === "NUMBER") return "O técnico informa um número na ordem.";
  if (taskType === "TEXT") return "O técnico escreve a resposta na ordem.";
  if (taskType === "SUBTASK") return "O técnico marca a tarefa como concluída.";
  return "Respondida em cada ordem gerada.";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[180px] flex-1 rounded-xl bg-[#f5f7fb] px-[18px] py-4">
      <div className="text-[13px] font-medium text-[#5b6b80]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function Info({ icon, label, value, last }: { icon: ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div className={`mt-3 flex items-start gap-3.5 border-t border-[#e9edf3] py-3.5 ${last ? "pb-0" : ""}`}>
      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#eef3fb] text-[#0b1b33]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">{label}</div>
        <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
      </div>
    </div>
  );
}

function priorityClass(priority: string) {
  if (priority === "HIGH") return "bg-[rgba(208,59,59,0.11)] text-[#b42323]";
  if (priority === "MEDIUM") return "bg-[rgba(250,178,25,0.22)] text-[#8a5600]";
  if (priority === "LOW") return "bg-[rgba(12,163,12,0.11)] text-[#006300]";
  return "bg-[#f5f7fb] text-[#4a5a70]";
}
