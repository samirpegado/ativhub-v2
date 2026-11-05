"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkOrderDrawer } from "@/components/work-orders/work-order-drawer";
import { WorkOrderTasksDialog } from "@/components/work-orders/work-order-tasks-dialog";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { DashboardAgendaItem, DashboardFilters, WorkOrderDashboard } from "@/lib/work-orders/dashboard";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  workOrderPriorityLabel,
  workOrderStatusLabel,
} from "@/lib/work-orders/status";

export function WorkOrderDashboardView({
  filters,
  dashboard,
  locations,
  workers,
  canManage,
  tenantId,
}: {
  filters: DashboardFilters;
  dashboard: WorkOrderDashboard;
  locations: { id: string; name: string }[];
  workers: { id: string; name: string }[];
  canManage: boolean;
  tenantId: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [answering, setAnswering] = useState<WorkOrderRecord | null>(null);
  const [taskRevision, setTaskRevision] = useState(0);

  function visit(next: Partial<DashboardFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams(window.location.search);
    setParam(params, "d_from", merged.from);
    setParam(params, "d_to", merged.to);
    setParam(params, "d_worker", canManage ? merged.workerId : null);
    setParam(params, "d_location", merged.locationId);
    setParam(params, "d_type", merged.type);
    setParam(params, "d_status", merged.status);
    setParam(params, "d_priority", merged.priority);
    setParam(params, "d_situation", merged.situation);
    const query = params.toString();
    const path = window.location.pathname;
    router.push(query ? `${path}?${query}` : path);
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{canManage ? "Dashboard" : "Minhas ordens"}</h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Acompanhe quem está executando e o que ainda falta fechar."
            : "Ordens atribuídas a você, o que já fechou e a agenda do que falta executar."}
        </p>
      </div>

      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={canManage ? "No filtro" : "Atribuídas"} value={dashboard.total} />
        <Stat label="A fechar" value={dashboard.remaining} />
        <Stat label="Fechadas" value={dashboard.closed} />
        <Stat label="Em execução" value={dashboard.executing.length} />
      </Card>

      <Card className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">De</span>
          <Input type="date" className="h-9" value={filters.from ?? ""} onChange={(event) => visit({ from: event.target.value || null })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Até</span>
          <Input type="date" className="h-9" value={filters.to ?? ""} onChange={(event) => visit({ to: event.target.value || null })} />
        </label>
        {canManage ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Técnico</span>
            <NativeSelect className="h-9" value={filters.workerId ?? ""} onChange={(event) => visit({ workerId: event.target.value || null })}>
              <option value="">Todos</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.name}</option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Localização</span>
          <NativeSelect className="h-9" value={filters.locationId ?? ""} onChange={(event) => visit({ locationId: event.target.value || null })}>
            <option value="">Todas</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Tipo</span>
          <NativeSelect className="h-9" value={filters.type ?? ""} onChange={(event) => visit({ type: event.target.value || null })}>
            <option value="">Todos</option>
            {WORK_ORDER_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <NativeSelect className="h-9" value={filters.status ?? ""} onChange={(event) => visit({ status: event.target.value || null })}>
            <option value="">Todos</option>
            {WORK_ORDER_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Prioridade</span>
          <NativeSelect className="h-9" value={filters.priority ?? ""} onChange={(event) => visit({ priority: event.target.value || null })}>
            <option value="">Todas</option>
            {WORK_ORDER_PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Situação</span>
          <NativeSelect className="h-9" value={filters.situation ?? ""} onChange={(event) => visit({ situation: event.target.value === "overdue" || event.target.value === "on_time" ? event.target.value : null })}>
            <option value="">Todas</option>
            <option value="overdue">Em atraso</option>
            <option value="on_time">No prazo</option>
          </NativeSelect>
        </label>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="h-9" onClick={() => visit({
            from: null, to: null, workerId: null, locationId: null, type: null, status: null, priority: null, situation: null,
          })}>
            Limpar
          </Button>
        </div>
      </Card>

      {canManage ? (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Quem está executando</h2>
          {dashboard.executing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum temporizador em andamento neste filtro.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.executing.map((item) => (
                <li key={`${item.id}-${item.worker}`}>
                  <button type="button" className="w-full rounded-lg border px-3 py-2 text-left hover:bg-muted" onClick={() => setOpenId(item.id)}>
                    <span className="font-medium">{item.worker}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {item.customId ? `${item.customId} · ` : ""}
                      {item.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <div className="space-y-2">
        <h2 className="font-semibold">Agenda</h2>
        {dashboard.agenda.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ordem em aberto neste filtro.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {dashboard.agenda.map((item) => (
              <li key={item.id}>
                <AgendaCard item={item} onOpen={() => setOpenId(item.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <WorkOrderDrawer
        orderId={openId}
        order={null}
        tenantId={tenantId}
        open={openId !== null}
        canEdit={canManage}
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
          setTaskRevision((current) => current + 1);
        }}
      />
    </section>
  );
}

function AgendaCard({ item, onOpen }: { item: DashboardAgendaItem; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="h-full w-full rounded-xl border bg-card p-4 text-left shadow-sm hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{item.title}</p>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{workOrderStatusLabel(item.status)}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {item.customId ? `${item.customId} · ` : ""}
        {workOrderPriorityLabel(item.priority)}
      </p>
      <p className="mt-2 text-sm">{item.assetName ?? item.locationName ?? "Sem ativo"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.dueDate ? formatWhen(item.dueDate) : "Sem vencimento"}
        {item.workers ? ` · ${item.workers}` : ""}
      </p>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function setParam(params: URLSearchParams, key: string, value: string | null) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
