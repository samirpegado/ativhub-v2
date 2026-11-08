"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Flag, MapPin, Pencil, Trash2, Users, Wrench } from "lucide-react";
import { deletePreventive, setPreventivePaused } from "@/app/(app)/preventive/actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { PreventiveForm } from "@/components/preventive/preventive-form";
import { Button } from "@/components/ui/button";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import type { LocationOption } from "@/lib/locations/queries";
import type { MutationState } from "@/lib/forms/state";
import type {
  PreventiveAsset,
  PreventivePerson,
  PreventiveRecord,
  PreventiveTeam,
  PreventiveWorkOrder,
} from "@/lib/preventive/queries";
import {
  formatScheduleDate,
  nextRunLabel,
  recurrenceBaseLabel,
  scheduleDescription,
} from "@/lib/preventive/schedule";
import { taskTypeLabel } from "@/lib/work-orders/tasks";
import {
  workOrderPriorityLabel,
  workOrderStatusColor,
  workOrderStatusLabel,
} from "@/lib/work-orders/status";

const whiteButton = "h-11 rounded-[10px] border border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white";

export function PreventiveDetailView({
  schedule: initialSchedule,
  workOrders,
  canEdit,
  editor,
}: {
  schedule: PreventiveRecord;
  workOrders: PreventiveWorkOrder[];
  canEdit: boolean;
  editor: {
    locations: LocationOption[];
    assets: PreventiveAsset[];
    people: PreventivePerson[];
    teams: PreventiveTeam[];
    checklists: ChecklistRecord[];
    customers: { id: string; name: string }[];
  } | null;
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeState, remove, removing] = useActionState<MutationState, FormData>(deletePreventive, undefined);
  const [, startRefresh] = useTransition();

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
              {editor ? (
                <Button type="button" className="h-11 rounded-[10px]" onClick={() => setEditing(true)}>
                  <Pencil /> Editar
                </Button>
              ) : null}
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
            <h2 className="text-lg font-semibold tracking-tight">Tarefas</h2>
            <p className="mb-[18px] text-[13px] text-[#4a5a70]">Copiadas para cada ordem gerada</p>
            {schedule.tasks.length === 0 ? (
              <p className="text-sm text-[#4a5a70]">Este agendamento não tem tarefas.</p>
            ) : (
              <ul className="space-y-3">
                {schedule.tasks.map((task) => (
                  <li key={`${task.taskType}-${task.label}`} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-full border border-[#cbd5e1]" />
                    <div>
                      <div className="text-base font-semibold">{task.label}</div>
                      <div className="text-sm text-[#4a5a70]">{taskTypeLabel(task.taskType)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Ordens geradas">
            <h2 className="text-lg font-semibold tracking-tight">Ordens geradas</h2>
            <p className="mb-[18px] text-[13px] text-[#4a5a70]">As mais recentes deste agendamento</p>
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
          </section>
        </div>

        <section className="min-w-0 flex-1 basis-[320px] rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Ordem que será criada">
          <h2 className="text-lg font-semibold">Ordem que será criada</h2>
          <Info icon={<Wrench className="size-[18px]" />} label="Título" value={schedule.title} />
          {schedule.description ? <p className="mt-2 text-sm text-[#4a5a70]">{schedule.description}</p> : null}
          <Info icon={<MapPin className="size-[18px]" />} label="Localização" value={schedule.locationName ?? "—"} />
          <Info icon={<Wrench className="size-[18px]" />} label="Ativos" value={schedule.assetName ?? "—"} />
          <Info icon={<Users className="size-[18px]" />} label="Equipe" value={schedule.teamName ?? "—"} />
          <Info icon={<Users className="size-[18px]" />} label="Trabalhador" value={schedule.primaryUserName ?? "—"} />
          <Info
            icon={<CalendarClock className="size-[18px]" />}
            label="Duração estimada"
            value={schedule.estimatedDuration === null ? "—" : `${schedule.estimatedDuration} h`}
            last
          />
        </section>
      </div>

      {editor ? (
        <FormDialog open={editing} onOpenChange={setEditing} title="Editar agendamento" description={schedule.customId ?? undefined}>
          <PreventiveForm
            schedule={schedule}
            locations={editor.locations}
            assets={editor.assets}
            customers={editor.customers}
            people={editor.people}
            teams={editor.teams}
            checklists={editor.checklists}
            onCancel={() => setEditing(false)}
            onSuccess={() => {
              setEditing(false);
              startRefresh(() => router.refresh());
            }}
          />
        </FormDialog>
      ) : null}
    </div>
  );
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
