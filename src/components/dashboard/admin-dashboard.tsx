"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, ClipboardCheck, Wrench } from "lucide-react";
import { WorkOrderDrawer } from "@/components/work-orders/work-order-drawer";
import { WorkOrderTasksDialog } from "@/components/work-orders/work-order-tasks-dialog";
import { PeriodSelect } from "@/components/dashboard/period-select";
import { DashCard, DashTitle, Donut, Kpi, Meter } from "@/components/dashboard/widgets";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import {
  clock,
  longDate,
  pace,
  share,
  signedPercent,
  techRange,
  type MaintenanceOverview,
  type RunningOrder,
  type TechRange,
} from "@/lib/dashboard/overview";
import { workOrderStatusLabel, workOrderTypeLabel } from "@/lib/work-orders/status";

export function AdminDashboard({
  data,
  tenantId,
  range,
}: {
  data: MaintenanceOverview;
  tenantId: string;
  range: TechRange;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [answering, setAnswering] = useState<WorkOrderRecord | null>(null);
  const [taskRevision, setTaskRevision] = useState(0);
  const queue = data.board;
  const overItems = queue.filter((item) => pace(item.elapsedSeconds, item.estimatedSeconds) === "over");
  const warn = queue.filter((item) => pace(item.elapsedSeconds, item.estimatedSeconds) === "warn").length;
  const over = overItems.length;
  const ok = queue.length - over - warn;
  const overNames = overItems.slice(0, 3).map((item) => item.assetName).join(", ");
  const liveOver = data.running.filter((item) => pace(item.elapsedSeconds, item.estimatedSeconds) === "over").length;
  const closedDelta = signedPercent(data.closed30, data.closedPrev30);
  const statusTotal = data.status30.reduce((sum, item) => sum + item.count, 0);
  const maxWeek = Math.max(1, ...data.weeks.map((week) => week.closed));
  const maxRank = Math.max(1, ...data.correctiveRank.map((item) => item.count));
  const onTimeRate = data.due30 > 0 ? data.onTime30 / data.due30 : null;
  const mttrDelta = data.mttrSeconds != null && data.mttrPrevSeconds != null ? data.mttrSeconds - data.mttrPrevSeconds : null;
  const stopped = data.downCount + data.emergencyCount;
  const period = techRange(range);

  return (
    <div className="space-y-5 text-[#14233a]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-wide text-[#4a5a70] uppercase">Painel do administrador</p>
          <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight">Visão geral da manutenção</h1>
          <p className="mt-0.5 text-[#4a5a70]">{longDate(data.today)}</p>
        </div>
        <PeriodSelect range={range} />
      </header>

      <section aria-label="Indicadores de OS" className="flex flex-wrap gap-4">
        <Kpi
          label="OS a fechar"
          value={String(data.openCount)}
          icon={<ClipboardCheck className="size-5" />}
          tone={data.staleCount > 0 ? "warn" : "ok"}
          note={data.staleCount > 0 ? `${data.staleCount} paradas há mais de 48 h` : "Nenhuma parada há mais de 48 h"}
        />
        <Kpi
          label="OS fechadas"
          value={String(data.closed30)}
          icon={<CheckCircle2 className="size-5" />}
          tone={closedDelta != null && closedDelta < 0 ? "warn" : "ok"}
          note={closedDelta == null ? "Sem base no período anterior" : `${closedDelta > 0 ? "+" : ""}${closedDelta}% vs. período anterior`}
        />
        <Kpi
          label="OS em execução"
          value={String(data.running.length)}
          icon={<Wrench className="size-5" />}
          tone={liveOver > 0 ? "crit" : "ok"}
          note={liveOver > 0 ? `${liveOver} acima do tempo estimado` : "Nenhuma acima do tempo estimado"}
        />
        <Kpi
          label="OS vencidas"
          value={String(data.overdueCount)}
          icon={<Clock3 className="size-5" />}
          tone={data.overdueCount > 0 ? "crit" : "ok"}
          valueClassName={data.overdueCount > 0 ? "text-[#b42323]" : undefined}
          note="Prazo de atendimento expirado"
        />
      </section>

      <div className="space-y-5">
          <DashCard label="OS em andamento" className="scroll-mt-4">
            <div id="andamento" className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
              <DashTitle title="Em andamento agora" hint={`${queue.length} OS ainda não concluídas · tempo registrado × tempo estimado`} />
              <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
                <Pill tone="crit">{over} acima do estimado</Pill>
                <Pill tone="warn">{warn} perto do limite</Pill>
                <Pill tone="ok">{ok} no prazo</Pill>
              </div>
            </div>
            {queue.length === 0 ? (
              <p className="border-t border-[#e9edf3] pt-3 text-sm text-[#4a5a70]">Nenhuma OS em aberto.</p>
            ) : (
              <div>
                <div className="hidden gap-5 pb-2 text-xs font-semibold tracking-wide text-[#64748b] uppercase lg:flex">
                  <div className="min-w-[190px] flex-[1.4]">Ativo / OS</div>
                  <div className="min-w-[150px] flex-1">Executor</div>
                  <div className="min-w-[210px] flex-[1.6]">Tempo</div>
                  <div className="w-[156px]">Situação</div>
                </div>
                {queue.map((item) => (
                  <RunningRow key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
                ))}
              </div>
            )}
          </DashCard>

          <div className="grid items-stretch gap-5 xl:grid-cols-3">
          <DashCard label="Precisa de atenção" className="h-full">
            <DashTitle title="Precisa de atenção" hint="O que pede uma decisão hoje" />
            <Attention
              tone={over > 0 ? "crit" : "ok"}
              title={over > 0 ? `${over} OS acima do tempo estimado` : "Nenhuma OS acima do tempo"}
              detail={overNames || "O tempo registrado está dentro do estimado."}
              href="/work-orders"
            />
            <Attention
              tone={stopped > 0 ? "crit" : "ok"}
              title={stopped > 0 ? `${stopped} ativos fora de operação` : "Nenhum ativo fora de operação"}
              detail={`${data.downCount} fora de serviço · ${data.emergencyCount} em desligamento de emergência`}
              href="/assets?status=DOWN,EMERGENCY_SHUTDOWN"
            />
            <Attention
              tone={data.overdueCount > 0 ? "crit" : "ok"}
              title={data.overdueCount > 0 ? `${data.overdueCount} OS vencidas` : "Nenhuma OS vencida"}
              detail="Prazo de atendimento expirado"
              href="/work-orders?overdue=1"
            />
            <Attention
              tone={data.staleCount > 0 ? "warn" : "ok"}
              title={data.staleCount > 0 ? `${data.staleCount} OS paradas há mais de 48 h` : "Nenhuma OS parada há mais de 48 h"}
              detail="Abertas ou em espera, sem alguém executando agora."
              href="/work-orders?status=OPEN,ON_HOLD"
            />
          </DashCard>

          <DashCard label="OS por status" className="flex h-full flex-col">
            <DashTitle title="OS por status" hint={`${period.queue} · ${statusTotal} OS`} />
            <div className="flex justify-center py-4">
              <Donut slices={data.status30.map((item) => ({ value: item.count, color: item.color }))} total={statusTotal} caption={`OS por status ${period.queue.toLowerCase()}`} />
            </div>
            {data.status30.map((item) => (
              <div key={item.status} className="flex items-center gap-2.5 border-t border-[#e9edf3] py-2">
                <span className="size-3 rounded-[3px]" style={{ background: item.color }} />
                <span className="flex-1 text-sm">{item.label}</span>
                <span className="text-sm font-semibold">{item.count}</span>
                <span className="w-11 text-right text-[13px] text-[#4a5a70]">{share(item.count, statusTotal)}</span>
              </div>
            ))}
            <p className="mt-auto pt-2.5 text-xs text-[#4a5a70]">Concluídas são as fechadas no período. As demais foram criadas no mesmo intervalo.</p>
          </DashCard>

          <DashCard label="Status dos ativos" className="h-full">
            <DashTitle title="Status dos ativos" hint={`${data.assetTotal} ativos cadastrados`} />
            <div className="flex items-baseline gap-2.5 py-4">
              <span className="text-[40px] leading-none font-semibold tracking-tight">{share(data.operationalCount, data.assetTotal)}</span>
              <span className="text-sm text-[#4a5a70]">estão operacionais</span>
            </div>
            <div className="mb-3.5 flex h-[22px] gap-0.5" role="img" aria-label="Distribuição dos ativos por status">
              {data.assets.filter((item) => item.count > 0).map((item) => (
                <div key={item.status} title={`${item.label}: ${item.count}`} className="min-w-0 rounded-[3px]" style={{ flex: item.count, background: item.color }} />
              ))}
            </div>
            {data.assets.map((item) => (
              <div key={item.status} className="flex items-center gap-2.5 border-t border-[#e9edf3] py-2">
                <span className="size-3 rounded-[3px]" style={{ background: item.color }} />
                <span className="min-w-0 flex-1 text-sm">{item.label}</span>
                <span className="text-sm font-semibold">{item.count}</span>
                <span className="w-12 text-right text-[13px] text-[#4a5a70]">{share(item.count, data.assetTotal, 1)}</span>
              </div>
            ))}
          </DashCard>
          </div>

          <div className="grid items-stretch gap-5 xl:grid-cols-3">
            <DashCard className="flex h-full flex-col">
              <DashTitle title="OS fechadas por semana" hint={period.queue} />
              <div className="mt-3 flex min-h-52 flex-1 items-stretch gap-3">
                {data.weeks.map((week) => (
                  <div key={week.start} className="flex min-w-0 flex-1 flex-col items-center">
                    <div className="min-h-0 w-full" style={{ flexGrow: Math.max(0, maxWeek - week.closed) }} />
                    <span className="text-[13px] font-semibold">{week.closed}</span>
                    <div
                      title={`${week.closed} OS fechadas`}
                      className="mt-1.5 w-full max-w-11 rounded-t bg-[#2a78d6]"
                      style={{ flexGrow: week.closed, flexBasis: 0, minHeight: week.closed > 0 ? 8 : 0, opacity: week.current ? 0.5 : 1 }}
                    />
                    <div className="mt-1.5 h-px w-full bg-[#cbd5e1]" />
                    <span className="text-xs text-[#4a5a70]">{week.current ? `${week.label}*` : week.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#4a5a70]">* Semana em andamento.</p>
            </DashCard>

            <DashCard className="flex h-full flex-col gap-3.5">
              <DashTitle title="Ativos com mais corretivas" hint={`${period.queue} · quantidade de OS corretivas`} />
              {data.correctiveRank.length === 0 ? (
                <p className="text-sm text-[#4a5a70]">Nenhuma corretiva no período.</p>
              ) : (
                data.correctiveRank.map((item) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-semibold">{item.count}</span>
                    </div>
                    <Meter value={item.count} max={maxRank} color="#eb6834" />
                  </div>
                ))
              )}
              <p className="mt-auto text-[13px] text-[#4a5a70]">Ativos com 4 ou mais corretivas no período são candidatos a revisão do plano preventivo.</p>
            </DashCard>

            <DashCard className="flex h-full flex-col">
          <DashTitle title="Indicadores de desempenho" hint={period.queue} />
          <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
          <div className="border-t border-[#e9edf3] pt-3">
            <div className="text-[13px] text-[#4a5a70]">Tempo médio de reparo (MTTR)</div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="text-[28px] font-semibold tracking-tight">{data.mttrSeconds == null ? "—" : clock(data.mttrSeconds)}</span>
              {mttrDelta != null ? (
                <Pill tone={mttrDelta <= 0 ? "ok" : "warn"}>
                  {mttrDelta <= 0 ? "−" : "+"}
                  {clock(Math.abs(mttrDelta))} vs. período anterior
                </Pill>
              ) : (
                <span className="text-xs text-[#4a5a70]">Sem corretivas suficientes para comparar.</span>
              )}
            </div>
          </div>
          <div className="border-t border-[#e9edf3] pt-3">
            <div className="text-[13px] text-[#4a5a70]">Cumpridas no prazo</div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="text-[28px] font-semibold tracking-tight">{onTimeRate == null ? "—" : share(data.onTime30, data.due30)}</span>
              <Pill tone={onTimeRate != null && onTimeRate >= 0.9 ? "ok" : "warn"}>
                {onTimeRate == null
                  ? "Sem OS com vencimento no período"
                  : onTimeRate >= 0.9
                    ? "Na meta de 90% ou acima"
                    : `${Math.round((0.9 - onTimeRate) * 100)} pontos abaixo da meta de 90%`}
              </Pill>
            </div>
            <p className="mt-1 text-xs text-[#4a5a70]">{data.onTime30} de {data.due30} fechadas até o vencimento.</p>
          </div>
          <div className="border-t border-[#e9edf3] pt-3">
            <div className="text-[13px] text-[#4a5a70]">OS em espera</div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="text-[28px] font-semibold tracking-tight">{data.onHoldCount} OS</span>
              <Pill tone={data.onHoldCount > 0 ? "warn" : "ok"}>{data.onHoldCount > 0 ? "Aguardando retomada" : "Nenhuma em espera"}</Pill>
            </div>
          </div>
          </div>
        </DashCard>
        </div>
      </div>

      <WorkOrderDrawer
        orderId={openId}
        order={null}
        tenantId={tenantId}
        open={openId !== null}
        canEdit
        reloadToken={taskRevision}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        onEdit={() => setOpenId(null)}
        onAnswer={setAnswering}
      />
      <WorkOrderTasksDialog
        order={answering}
        onOpenChange={(next) => {
          if (!next) setAnswering(null);
        }}
        onExecuted={(next) => {
          setAnswering(next);
          setTaskRevision((value) => value + 1);
        }}
      />
    </div>
  );
}

function RunningRow({ item, onOpen }: { item: RunningOrder; onOpen: () => void }) {
  const elapsed = useLiveElapsed(item.elapsedSeconds, item.live);
  const state = pace(elapsed, item.estimatedSeconds);
  const ratio = item.estimatedSeconds > 0 ? Math.min(100, Math.round((elapsed / item.estimatedSeconds) * 100)) : 0;
  const color = state === "over" ? "#d03b3b" : state === "warn" ? "#fab219" : "#0ca30c";
  const situation = state === "over"
    ? "Acima do estimado"
    : item.live && state === "warn"
      ? "Perto do limite"
      : item.live && item.estimatedSeconds > 0
        ? "No prazo"
        : workOrderStatusLabel(item.status);
  const tone = state === "over" ? "crit" : item.live && state === "warn" ? "warn" : item.status === "ON_HOLD" ? "warn" : "ok";
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#e9edf3] py-3.5 text-left hover:bg-[#f7f9fc]">
      <div className="min-w-[190px] flex-[1.4]">
        <div className="text-[15px] font-semibold">{item.assetName}</div>
        <div className="font-mono text-xs text-[#4a5a70]">{[item.customId, workOrderTypeLabel(item.type)].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="flex min-w-[150px] flex-1 items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#e9edf3] text-xs font-semibold">{item.initials}</span>
        <span className="text-sm">{item.worker}</span>
      </div>
      <div className="min-w-[210px] flex-[1.6]">
        <div className="mb-1.5 flex justify-between gap-2 text-[13px]">
          <span>
            <span className="font-mono font-medium">{clock(elapsed)}</span>
            <span className="text-[#4a5a70]"> {item.estimatedSeconds > 0 ? `de ${clock(item.estimatedSeconds)}` : "sem estimativa"}</span>
          </span>
          <span className={state === "over" ? "font-semibold text-[#b42323]" : "font-semibold text-[#4a5a70]"}>
            {item.estimatedSeconds <= 0 ? "—" : state === "over" ? `+${clock(elapsed - item.estimatedSeconds)}` : `restam ${clock(item.estimatedSeconds - elapsed)}`}
          </span>
        </div>
        <Meter value={ratio} max={100} color={color} />
      </div>
      <div className="w-full lg:w-[156px]">
        <Pill tone={tone}>{situation}</Pill>
      </div>
    </button>
  );
}

function useLiveElapsed(base: number, ticking: boolean) {
  const [seconds, setSeconds] = useState(base);
  useEffect(() => {
    setSeconds(base);
    if (!ticking) return;
    const origin = Date.now();
    const id = window.setInterval(() => {
      setSeconds(base + Math.max(0, Math.floor((Date.now() - origin) / 1000)));
    }, 30000);
    return () => window.clearInterval(id);
  }, [base, ticking]);
  return seconds;
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "crit"; children: ReactNode }) {
  const toneClass = {
    ok: "bg-[rgba(12,163,12,0.11)] text-[#006300]",
    warn: "bg-[rgba(250,178,25,0.22)] text-[#8a5600]",
    crit: "bg-[rgba(208,59,59,0.11)] text-[#b42323]",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${toneClass}`}>{children}</span>;
}

function Attention({
  title,
  detail,
  href,
  tone,
}: {
  title: string;
  detail: string;
  href: string;
  tone: "ok" | "warn" | "crit";
}) {
  const toneClass = tone === "ok" ? "bg-[rgba(12,163,12,0.11)] text-[#006300]" : tone === "warn" ? "bg-[rgba(250,178,25,0.22)] text-[#8a5600]" : "bg-[rgba(208,59,59,0.11)] text-[#b42323]";
  return (
    <div className="flex items-start gap-3 border-t border-[#e9edf3] py-3">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${toneClass}`}>
        <AlertTriangle className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-[13px] text-[#4a5a70]">{detail}</div>
      </div>
      <Link href={href} className="text-[13px] font-semibold whitespace-nowrap">Ver →</Link>
    </div>
  );
}
