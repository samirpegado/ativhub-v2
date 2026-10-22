"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { fetchPreventiveDetail, setPreventivePaused } from "@/app/(app)/preventive/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PreventiveDetail, PreventiveRecord } from "@/lib/preventive/queries";
import {
  formatScheduleDate,
  nextRunLabel,
  recurrenceBaseLabel,
  scheduleDescription,
} from "@/lib/preventive/schedule";
import { taskTypeLabel } from "@/lib/work-orders/tasks";
import { workOrderPriorityLabel, workOrderStatusLabel } from "@/lib/work-orders/status";
import { cn } from "@/lib/utils";

export function PreventiveDrawer({
  scheduleId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  scheduleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (schedule: PreventiveRecord) => void;
  onDelete: (schedule: PreventiveRecord) => void;
}) {
  const [detail, setDetail] = useState<PreventiveDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "orders">("details");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!scheduleId || !open) return;
    setDetail(null);
    setError(null);
    setTab("details");
    let cancelled = false;
    fetchPreventiveDetail(scheduleId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, scheduleId]);

  if (!open || !scheduleId) return null;
  const schedule = detail?.schedule ?? null;
  const orders = detail?.workOrders ?? [];

  async function togglePause() {
    if (!schedule) return;
    setBusy(true);
    const result = await setPreventivePaused(schedule.id, !schedule.disabled);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const next = await fetchPreventiveDetail(schedule.id);
    if ("error" in next) {
      setError(next.error);
      return;
    }
    setDetail(next);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="border-b pr-12">
          <SheetDescription>{schedule?.customId ?? "Agendamento"}</SheetDescription>
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-xl font-bold">{schedule?.name ?? "Preventiva"}</SheetTitle>
            {schedule ? (
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => onEdit(schedule)}
                >
                  <Pencil />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-destructive"
                  onClick={() => onDelete(schedule)}
                >
                  <Trash2 />
                </Button>
              </div>
            ) : null}
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!schedule ? (
            error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <div className="flex justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )
          ) : (
            <div className="space-y-5">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                {schedule.disabled ? (
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">Pausado</span>
                ) : null}
                <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={togglePause}>
                  {schedule.disabled ? "Retomar" : "Pausar"}
                </Button>
              </div>
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <TabButton active={tab === "details"} onClick={() => setTab("details")}>
                  Detalhes
                </TabButton>
                <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
                  Ordens geradas
                </TabButton>
              </div>
              {tab === "details" ? (
                <div className="space-y-5">
                  <section className="space-y-2">
                    <h3 className="font-semibold">Recorrência</h3>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <Detail label="Base" value={recurrenceBaseLabel(schedule.recurrenceBasedOn)} />
                      <Detail
                        label="Frequência"
                        value={scheduleDescription(schedule)}
                      />
                      <Detail label="Começa em" value={formatScheduleDate(schedule.startsOn)} />
                      <Detail label="Termina em" value={formatScheduleDate(schedule.endsOn)} />
                      <Detail label="Próxima ordem" value={nextRunLabel(schedule)} />
                      <Detail
                        label="Vencimento"
                        value={
                          schedule.dueDateDelay === null
                            ? "—"
                            : `${schedule.dueDateDelay} dia${schedule.dueDateDelay === 1 ? "" : "s"} depois`
                        }
                      />
                    </dl>
                  </section>
                  <section className="space-y-2">
                    <h3 className="font-semibold">Ordem</h3>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <Detail label="Título" value={schedule.title} />
                      <Detail label="Prioridade" value={workOrderPriorityLabel(schedule.priority)} />
                      <Detail label="Localização" value={schedule.locationName ?? "—"} />
                      <Detail label="Ativo" value={schedule.assetName ?? "—"} />
                      <Detail label="Trabalhador" value={schedule.primaryUserName ?? "—"} />
                      <Detail label="Equipe" value={schedule.teamName ?? "—"} />
                      <Detail
                        label="Duração"
                        value={
                          schedule.estimatedDuration === null ? "—" : `${schedule.estimatedDuration} h`
                        }
                      />
                    </dl>
                    {schedule.description ? (
                      <p className="text-sm whitespace-pre-wrap">{schedule.description}</p>
                    ) : null}
                    {schedule.tasks.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {schedule.tasks.map((task) => (
                          <li key={`${task.taskType}-${task.label}`}>
                            {task.label}
                            <span className="text-muted-foreground"> · {taskTypeLabel(task.taskType)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma tarefa.</p>
                    )}
                  </section>
                </div>
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ordem gerada ainda.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {orders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3">
                      <span>
                        {order.customId ? `${order.customId} · ` : ""}
                        {order.title}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {workOrderStatusLabel(order.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("h-8 px-3", active && "bg-background shadow-sm hover:bg-background")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
