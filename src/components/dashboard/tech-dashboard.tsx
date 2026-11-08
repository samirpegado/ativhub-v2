"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Clock3, Wrench } from "lucide-react";
import { completeWorkOrder, loadWorkOrderActivity, toggleWorkOrderTimer } from "@/app/(app)/work-orders/activity-actions";
import { PeriodSelect } from "@/components/dashboard/period-select";
import { DashCard, DashTitle, Meter } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { WorkOrderTasksDialog } from "@/components/work-orders/work-order-tasks-dialog";
import {
  civilDay,
  civilTime,
  clock,
  longDate,
  pace,
  share,
  techRange,
  type MaintenanceOverview,
  type TechRange,
  type UpcomingOrder,
} from "@/lib/dashboard/overview";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import { workOrderTypeLabel } from "@/lib/work-orders/status";

export function TechDashboard({
  data,
  firstName,
  range,
}: {
  data: MaintenanceOverview;
  firstName: string;
  range: TechRange;
}) {
  const router = useRouter();
  const [answering, setAnswering] = useState<WorkOrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const active = data.running[0] ?? null;
  const elapsed = useLiveElapsed(active?.startedAt ?? null, active?.elapsedSeconds ?? 0);
  const state = active ? pace(elapsed, active.estimatedSeconds) : "none";
  const done = data.onTime5w;
  const late = data.late5w;
  const rated = done + late;
  const onTime = rated > 0 ? done / rated : null;
  const weeks = data.weeks;
  const maxWeek = Math.max(1, ...weeks.map((week) => week.onTime + week.late));
  const typeMax = Math.max(1, ...data.byType.map((item) => item.count));
  const typeTotal = data.byType.reduce((sum, item) => sum + item.count, 0);
  const tomorrow = shiftDay(data.today, 1);
  const period = techRange(range);

  function openChecklist(workOrderId: string) {
    setError(null);
    startTransition(async () => {
      const result = await loadWorkOrderActivity(workOrderId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.order) setAnswering(result.order);
    });
  }

  function run(action: () => Promise<{ error?: string } | { error: string } | object>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 text-[#14233a]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-wide text-[#4a5a70] uppercase">Painel do técnico</p>
          <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight">Olá, {firstName || "técnico"}</h1>
          <p className="mt-0.5 text-[#4a5a70]">{longDate(data.today)}</p>
        </div>
        <PeriodSelect range={range} />
      </header>

      <section aria-label="Minhas OS" className="flex flex-wrap gap-4">
        <DashCard className="flex min-w-[220px] flex-1 flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#4a5a70]">A fechar</span>
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#e9edf3]"><ClipboardCheck className="size-5" /></span>
          </div>
          <div className="text-[44px] leading-none font-semibold tracking-tight">{data.readyCount}</div>
          <p className="text-[13px] text-[#4a5a70]">Com tempo e tarefas feitos, aguardando conclusão</p>
        </DashCard>
        <DashCard className="flex min-w-[220px] flex-1 flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#4a5a70]">Fechadas</span>
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#e9edf3]"><CheckCircle2 className="size-5" /></span>
          </div>
          <div className="text-[44px] leading-none font-semibold tracking-tight">{data.closed5w}</div>
          <p className="text-[13px] text-[#4a5a70]">{period.closed}</p>
        </DashCard>
        <DashCard className="flex min-w-[220px] flex-1 flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#4a5a70]">Em execução</span>
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#e9edf3]"><Wrench className="size-5" /></span>
          </div>
          <div className="text-[44px] leading-none font-semibold tracking-tight">{data.running.length}</div>
          {state === "over" ? (
            <span className="self-start rounded-full bg-[rgba(208,59,59,0.11)] px-2.5 py-1 text-[13px] font-medium text-[#b42323]">Acima do tempo estimado</span>
          ) : (
            <p className="text-[13px] text-[#4a5a70]">{active ? "Dentro do tempo estimado" : "Nenhuma OS com o tempo correndo"}</p>
          )}
        </DashCard>
        <DashCard className="flex min-w-[220px] flex-1 flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#4a5a70]">A iniciar</span>
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#e9edf3]"><Clock3 className="size-5" /></span>
          </div>
          <div className="text-[44px] leading-none font-semibold tracking-tight">{data.toStartCount}</div>
          <p className="text-[13px] text-[#4a5a70]">{period.start}</p>
        </DashCard>
      </section>

      <DashCard label="OS em execução" className="flex flex-wrap items-center gap-8">
        {active ? (
          <>
            <div className="min-w-[280px] flex-[1.3]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9edf3] px-2.5 py-1 text-xs font-semibold">
                <span className="size-2 rounded-full bg-[#eb6834]" />
                Em execução agora
              </span>
              <h2 className="mt-2.5 text-2xl font-semibold tracking-tight">{active.assetName}</h2>
              <p className="mt-0.5 font-mono text-[13px] text-[#4a5a70]">
                {[active.customId, workOrderTypeLabel(active.type), active.startedAt ? `iniciada às ${civilTime(active.startedAt)}` : null].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-[#4a5a70]">Checklist da OS</span>
                  <span className="font-semibold">{active.tasksDone} de {active.tasksTotal} itens</span>
                </div>
                <Meter value={active.tasksDone} max={Math.max(active.tasksTotal, 1)} color="#2a78d6" />
              </div>
            </div>
            <div className="min-w-[240px] flex-[1.2]">
              <div className="text-[13px] text-[#4a5a70]">Tempo decorrido</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5">
                <span className="font-mono text-4xl font-medium tracking-tight">{clock(elapsed)}</span>
                <span className="text-[#4a5a70]">{active.estimatedSeconds > 0 ? `de ${clock(active.estimatedSeconds)} estimadas` : "sem estimativa"}</span>
              </div>
              <div className="my-2.5">
                <Meter
                  value={active.estimatedSeconds > 0 ? Math.min(elapsed, active.estimatedSeconds) : 0}
                  max={Math.max(active.estimatedSeconds, 1)}
                  color={state === "over" ? "#d03b3b" : state === "warn" ? "#fab219" : "#0ca30c"}
                />
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[13px] font-semibold ${state === "over" ? "bg-[rgba(208,59,59,0.11)] text-[#b42323]" : "bg-[rgba(12,163,12,0.11)] text-[#006300]"}`}>
                {state === "over" ? `+${clock(elapsed - active.estimatedSeconds)} acima do estimado` : state === "warn" ? "Perto do limite" : "No prazo"}
              </span>
            </div>
            <div className="flex w-full max-w-[200px] flex-col gap-2.5">
              <Button type="button" className="h-12" disabled={pending} onClick={() => openChecklist(active.id)}>Abrir checklist</Button>
              <Button type="button" variant="outline" className="h-12" disabled={pending} onClick={() => run(() => completeWorkOrder(active.id))}>Concluir OS</Button>
              <Button type="button" variant="outline" className="h-12" disabled={pending} onClick={() => run(() => toggleWorkOrderTimer(active.id))}>Registrar pausa</Button>
            </div>
          </>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Nenhuma OS em execução</h2>
              <p className="mt-1 text-sm text-[#4a5a70]">Inicie a próxima obrigação para o tempo começar a contar.</p>
            </div>
          </div>
        )}
        {error ? <p className="w-full text-sm text-[#b42323]">{error}</p> : null}
      </DashCard>

      <div className="space-y-5">
          <DashCard label="Fila do período">
            <DashTitle title="Próximas obrigações" hint={period.queue} />
            {data.upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-[#4a5a70]">{period.empty}</p>
            ) : (
              data.upcoming.map((item) => (
                <UpcomingRow
                  key={item.id}
                  item={item}
                  today={data.today}
                  tomorrow={tomorrow}
                  pending={pending}
                  onOpen={() => router.push(`/work-orders/${item.id}`)}
                  onStart={() => run(() => toggleWorkOrderTimer(item.id))}
                />
              ))
            )}
          </DashCard>

          <div className="grid items-stretch gap-5 xl:grid-cols-3">
          <DashCard label="Cumprimento no prazo" className="h-full">
            <DashTitle title="Cumpridas no prazo" hint={period.queue} />
            <div className="flex flex-wrap items-center gap-5 pt-4">
              <div className="relative size-32 shrink-0">
                <svg viewBox="0 0 42 42" width="128" height="128" role="img" aria-label="Obrigações cumpridas no prazo">
                  <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e9edf3" strokeWidth="5" />
                  <circle
                    cx="21"
                    cy="21"
                    r="15.9155"
                    transform="rotate(-90 21 21)"
                    fill="none"
                    stroke="#008300"
                    strokeWidth="5"
                    strokeDasharray={`${onTime == null ? 0 : onTime * 100} ${onTime == null ? 100 : 100 - onTime * 100}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[30px] font-semibold">
                  {onTime == null ? "—" : share(done, rated)}
                </div>
              </div>
              <div className="min-w-[140px] flex-1 space-y-2">
                <p className="text-[15px]"><span className="font-semibold">{done} de {rated}</span> obrigações no prazo</p>
                <p className="text-[13px] text-[#4a5a70]">{late} fora do prazo</p>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${onTime != null && onTime >= 0.9 ? "bg-[rgba(12,163,12,0.11)] text-[#006300]" : "bg-[rgba(250,178,25,0.22)] text-[#8a5600]"}`}>
                  {onTime == null ? "Ainda sem fechamento no período" : onTime >= 0.9 ? "Acima da meta de 90%" : "Abaixo da meta de 90%"}
                </span>
              </div>
            </div>
          </DashCard>

          <DashCard label="Cumpridas por semana" className="flex h-full flex-col">
            <DashTitle title="Cumpridas por semana" hint={period.queue} />
            <div className="my-2.5 flex flex-wrap gap-3.5 text-xs text-[#4a5a70]">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-[#008300]" />No prazo</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-[#d03b3b]" />Fora do prazo</span>
            </div>
            <div className="flex min-h-48 flex-1 items-stretch gap-3">
              {weeks.map((week) => {
                const total = week.onTime + week.late;
                return (
                  <div key={week.start} className="flex min-w-0 flex-1 flex-col items-center">
                    <div className="min-h-0 w-full" style={{ flexGrow: Math.max(0, maxWeek - total) }} />
                    <span className="mb-1 text-[13px] font-semibold">{total}</span>
                    <div title={`${week.late} fora do prazo`} className="w-full max-w-11 bg-[#d03b3b]" style={{ flexGrow: week.late, flexBasis: 0 }} />
                    <div title={`${week.onTime} no prazo`} className="w-full max-w-11 bg-[#008300]" style={{ flexGrow: week.onTime, flexBasis: 0, opacity: week.current ? 0.55 : 1 }} />
                    <div className="mt-1 h-px w-full bg-[#cbd5e1]" />
                    <span className="mt-0.5 text-xs text-[#4a5a70]">{week.current ? `${week.label}*` : week.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2.5 text-xs text-[#4a5a70]">* Semana em andamento. Número acima da barra = obrigações da semana.</p>
          </DashCard>

          <DashCard label="Cumpridas por tipo" className="h-full">
            <DashTitle title="Cumpridas por tipo" hint={`${typeTotal} concluídas · ${period.queue.toLowerCase()}`} />
            <div className="mt-3 space-y-3.5">
              {data.byType.map((item) => (
                <div key={item.type} className="space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{item.label}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                  <Meter value={item.count} max={typeMax} color={item.color} />
                </div>
              ))}
            </div>
          </DashCard>
        </div>
      </div>

      <WorkOrderTasksDialog
        order={answering}
        onOpenChange={(next) => {
          if (!next) setAnswering(null);
        }}
        onExecuted={setAnswering}
      />
    </div>
  );
}

function UpcomingRow({
  item,
  today,
  tomorrow,
  pending,
  onOpen,
  onStart,
}: {
  item: UpcomingOrder;
  today: string;
  tomorrow: string;
  pending: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  const day = item.dueDate ? civilDay(item.dueDate) : "";
  const when = item.running
    ? "Hoje · em execução"
    : item.dueDate
      ? `${day === today ? "Hoje" : day === tomorrow ? "Amanhã" : day} · ${civilTime(item.dueDate)}${item.estimatedSeconds > 0 ? ` · est. ${clock(item.estimatedSeconds)}` : ""}`
      : "Sem horário";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-[#e9edf3] py-3.5">
      <div className="min-w-[220px] flex-[1.6]">
        <div className="text-[15px] font-semibold">{item.assetName}</div>
        <div className="font-mono text-xs text-[#4a5a70]">{[item.customId, workOrderTypeLabel(item.type)].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="min-w-[150px] flex-1 text-[13px] text-[#4a5a70]">{when}</div>
      {item.over ? (
        <span className="rounded-full bg-[rgba(208,59,59,0.11)] px-2.5 py-1 text-[13px] font-semibold text-[#b42323]">Acima do estimado</span>
      ) : (
        <span className="rounded-full bg-[#e9edf3] px-2.5 py-1 text-[13px] font-semibold">{item.running ? "Em execução" : "Pendente"}</span>
      )}
      {item.running ? (
        <Button type="button" variant="outline" className="h-11 min-w-24" onClick={onOpen}>Abrir</Button>
      ) : day === tomorrow ? (
        <Button type="button" variant="outline" className="h-11 min-w-24" onClick={onOpen}>Ver OS</Button>
      ) : (
        <Button type="button" className="h-11 min-w-24" disabled={pending} onClick={onStart}>Iniciar</Button>
      )}
    </div>
  );
}

function useLiveElapsed(startedAt: string | null, fallback: number) {
  const [seconds, setSeconds] = useState(fallback);
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const started = new Date(startedAt).getTime();
      setSeconds(Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : fallback);
    };
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [startedAt, fallback]);
  return seconds;
}

function shiftDay(isoDay: string, days: number) {
  const date = new Date(`${isoDay}T12:00:00`);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
