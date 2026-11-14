"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, Timer, Trash2 } from "lucide-react";
import { OpenWorkOrderReportButton } from "@/components/work-orders/open-work-order-report-button";
import {
  deleteWorkOrderFile,
  deleteWorkOrderLabor,
  completeWorkOrder,
  loadWorkOrderActivity,
  registerWorkOrderFile,
  removeWorkOrderPart,
  setWorkOrderStatus,
  toggleWorkOrderTimer,
} from "@/app/(app)/work-orders/activity-actions";
import { WorkOrderLaborDialog } from "@/components/work-orders/work-order-labor-dialog";
import { WorkOrderPartsDialog } from "@/components/work-orders/work-order-parts-dialog";
import { sendWorkOrderReport } from "@/app/(app)/work-orders/report-actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { ASSET_STATUSES } from "@/lib/assets/status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatQuantity } from "@/lib/inventory/format";
import { formatBrl } from "@/lib/money/brl";
import { partsTotal, serviceCharge } from "@/lib/work-orders/billing";
import { createClient } from "@/lib/supabase/client";
import {
  formatDuration,
  liveDuration,
  type WorkOrderActivity,
} from "@/lib/work-orders/activity";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import {
  WORK_ORDER_STATUSES,
  workOrderIsOverdue,
  workOrderPriorityLabel,
  workOrderStatusLabel,
  workOrderTypeLabel,
} from "@/lib/work-orders/status";
import { taskAnswerLabel } from "@/lib/work-orders/tasks";
import { cn } from "@/lib/utils";

const EMPTY_ACTIVITY: WorkOrderActivity = {
  timer: null,
  labors: [],
  files: [],
  updates: [],
  parts: [],
  partOptions: [],
};

function formatDay(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WorkOrderDrawer({
  orderId,
  order,
  tenantId,
  open,
  onOpenChange,
  onEdit,
  onAnswer,
  reloadToken = 0,
  canEdit = true,
}: {
  orderId: string | null;
  order: WorkOrderRecord | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: WorkOrderRecord) => void;
  onAnswer: (order: WorkOrderRecord) => void;
  reloadToken?: number;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"details" | "timeline">("details");
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [mailName, setMailName] = useState("");
  const [mailError, setMailError] = useState<string | null>(null);
  const [mailPending, startMail] = useTransition();
  const [activity, setActivity] = useState<WorkOrderActivity>(EMPTY_ACTIVITY);
  const [loaded, setLoaded] = useState<WorkOrderRecord | null>(null);
  const [detailReady, setDetailReady] = useState(false);
  const [status, setStatus] = useState(order?.status ?? "OPEN");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [partsOpen, setPartsOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  const [assetCloseOpen, setAssetCloseOpen] = useState(false);
  const [assetStatusValue, setAssetStatusValue] = useState("OPERATIONAL");
  const [assetStatusAt, setAssetStatusAt] = useState("");

  useEffect(() => {
    if (!orderId || !open) return;
    setTab("details");
    setError(null);
    setPartsOpen(false);
    setLaborOpen(false);
    setLoaded(null);
    setActivity(EMPTY_ACTIVITY);
    setDetailReady(false);
  }, [open, orderId]);

  useEffect(() => {
    if (!orderId || !open) return;
    let cancelled = false;
    loadWorkOrderActivity(orderId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        setDetailReady(true);
        return;
      }
      setActivity(result.activity);
      if (result.order) {
        setLoaded(result.order);
        setStatus(result.order.status);
      }
      setDetailReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, orderId, reloadToken]);

  useEffect(() => {
    if (order && order.id === orderId) setStatus(order.status);
  }, [order, orderId]);

  useEffect(() => {
    const runningClock = Boolean(activity.timer?.startedAt) || activity.labors.some((labor) => labor.startedAt);
    if (!runningClock) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activity.timer?.startedAt, activity.labors]);

  if (!open || !orderId) return null;

  const current = detailReady && loaded?.id === orderId ? loaded : null;

  if (!current) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-xl"
        >
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Ordem de serviço</SheetTitle>
            <SheetDescription>Carregando detalhes.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 items-center justify-center py-16">
            {error ? (
              <p className="px-6 text-center text-sm text-destructive">{error}</p>
            ) : (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  const record = current;
  const running = Boolean(activity.timer?.startedAt);
  const timerLabel = formatDuration(liveDuration(activity.timer, now));

  function apply(result: { error: string } | { activity: WorkOrderActivity; order?: WorkOrderRecord }) {
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setActivity(result.activity);
    if (result.order) {
      setLoaded(result.order);
      setStatus(result.order.status);
    }
  }

  async function finishOrder() {
    setBusy(true);
    const result = await completeWorkOrder(record.id);
    setBusy(false);
    apply(result);
    if (!("error" in result)) router.refresh();
  }

  async function commitStatus(next: string, asset?: { status: string; at: string }) {
    setStatus(next);
    setBusy(true);
    const result = await setWorkOrderStatus(record.id, next, asset);
    setBusy(false);
    if ("error" in result) {
      setStatus(record.status);
      setError(result.error);
      return;
    }
    setError(null);
    setAssetCloseOpen(false);
    router.refresh();
  }

  async function changeStatus(next: string) {
    if (next === "COMPLETE" && record.assetId && next !== record.status) {
      setAssetStatusValue("OPERATIONAL");
      setAssetStatusAt(toDatetimeLocal(new Date().toISOString()));
      setAssetCloseOpen(true);
      return;
    }
    await commitStatus(next);
  }

  async function toggleTimer() {
    setBusy(true);
    const result = await toggleWorkOrderTimer(record.id);
    setBusy(false);
    apply(result);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const allowed = ["pdf", "png", "jpg", "jpeg", "webp", "txt", "doc", "docx", "xls", "xlsx"];
    const fromName = file.name.includes(".") ? (file.name.split(".").pop()?.toLowerCase() ?? "") : "";
    const fromType =
      file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "";
    const extension = allowed.includes(fromName) ? fromName : fromType;
    if (!extension) {
      setError("Envie PDF, imagem, texto ou planilha.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    const path = `${tenantId}/work-orders/${record.id}/${crypto.randomUUID()}.${extension}`;
    setBusy(true);
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) {
      setBusy(false);
      setError("Não foi possível enviar o arquivo.");
      return;
    }
    const result = await registerWorkOrderFile(record.id, path, file.name.trim() || `foto.${extension}`);
    setBusy(false);
    if ("error" in result) {
      await supabase.storage.from("attachments").remove([path]);
    }
    apply(result);
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="border-b pr-12">
          <SheetDescription>
            {record.customId ?? "Ordem de serviço"}
          </SheetDescription>
          <SheetTitle className="text-xl font-bold">
            {record.title}
            <span className="ml-2 align-middle text-xs font-semibold text-muted-foreground">
              {workOrderTypeLabel(record.type)}
            </span>
            {workOrderIsOverdue(record) ? (
              <span className="ml-2 align-middle rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                Em atraso
              </span>
            ) : null}
          </SheetTitle>
          {record.description ? (
            <p className="text-sm text-muted-foreground">{record.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canEdit ? (
              <NativeSelect
                className="h-9 max-w-44"
                value={status}
                disabled={busy}
                onChange={(event) => changeStatus(event.target.value)}
              >
                {WORK_ORDER_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <span className="inline-flex h-9 items-center rounded-lg bg-muted px-3 text-sm font-medium">
                {workOrderStatusLabel(status)}
              </span>
            )}
            {!canEdit && status !== "COMPLETE" ? (
              <Button type="button" className="h-9" disabled={busy} onClick={finishOrder}>
                Concluir
              </Button>
            ) : null}
            <Button
              type="button"
              variant={running ? "default" : "outline"}
              className="h-9"
              disabled={busy}
              onClick={toggleTimer}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Timer />}
              {running ? "Temporizador em execução" : "Executar temporizador"} · {timerLabel}
            </Button>
            <OpenWorkOrderReportButton workOrderId={record.id} className="h-9" />
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => {
                setMailTo(record.customerEmail ?? "");
                setMailName(record.customerName ?? "");
                setMailError(null);
                setMailOpen(true);
              }}
            >
              Enviar por e-mail
            </Button>
            {canEdit ? (
              <Button type="button" variant="ghost" className="h-9" onClick={() => onEdit(record)}>
                Editar
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex w-fit gap-1 rounded-lg bg-muted p-1">
            <TabButton active={tab === "details"} onClick={() => setTab("details")}>
              Detalhes
            </TabButton>
            <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
              Timeline
            </TabButton>
          </div>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

          {tab === "details" ? (
            <div className="space-y-6">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Empresa" value={record.companyName || "—"} />
                {record.customerName ? (
                  <Detail
                    label="Cliente"
                    value={[record.customerName, record.customerPhone].filter(Boolean).join(" · ")}
                  />
                ) : null}
                <Detail label="Prioridade" value={workOrderPriorityLabel(record.priority)} />
                <Detail label="Vencimento" value={formatWhen(record.dueDate)} />
                <Detail label="Localização" value={record.locationName ?? "—"} />
                <Detail label="Ativo" value={record.assetName ?? "—"} />
                <Detail
                  label="Responsáveis"
                  value={record.assignees.map((person) => person.name).join(", ") || "—"}
                />
              </dl>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Tarefas</h3>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => onAnswer(record)}
                  >
                    <ClipboardCheck />
                    Executar tarefas
                  </Button>
                </div>
                {record.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Esta ordem não tem tarefas.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {record.tasks.map((task) => (
                      <li key={task.id ?? task.label}>
                        <div className="flex justify-between gap-3">
                          <span>{task.label}</span>
                          <span className="font-medium">
                            {task.value ? taskAnswerLabel(task) : "Pendente"}
                          </span>
                        </div>
                        {task.executedAt ? (
                          <p className="text-xs text-muted-foreground">
                            {formatWhen(task.executedAt)}
                            {task.comment ? ` — ${task.comment}` : ""}
                          </p>
                        ) : task.value ? (
                          <p className="text-xs text-muted-foreground">Resposta anterior, sem data de execução</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Peças</h3>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => setPartsOpen(true)}
                  >
                    Adicionar peças
                  </Button>
                </div>
                {activity.parts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma peça nesta ordem.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {activity.parts.map((part) => (
                      <li key={part.id} className="flex items-center justify-between gap-2">
                        <span>
                          {part.name}
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatQuantity(part.quantity, part.unit)} ·{" "}
                            {formatBrl(part.cost * part.quantity)}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-destructive"
                          aria-label={`Remover ${part.name}`}
                          onClick={() => removeWorkOrderPart(record.id, part.id).then(apply)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {record.billingMode === "NONE" ? null : (
                <section className="space-y-1 text-sm">
                  <h3 className="font-semibold">Cobrança</h3>
                  <p>Serviço · {formatBrl(serviceCharge(record, activity))}</p>
                  <p>Peças · {formatBrl(partsTotal(activity.parts))}</p>
                  <p className="font-semibold">
                    Total · {formatBrl(serviceCharge(record, activity) + partsTotal(activity.parts))}
                  </p>
                </section>
              )}

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Mão de obra</h3>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => setLaborOpen(true)}
                  >
                    Adicionar tempo
                  </Button>
                </div>
                {activity.labors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum tempo lançado.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {activity.labors.map((labor) => {
                      const seconds = labor.startedAt
                        ? liveDuration(
                            {
                              durationSeconds: labor.durationSeconds,
                              startedAt: labor.startedAt,
                              hourlyRate: labor.hourlyRate,
                            },
                            now,
                          )
                        : labor.durationSeconds;
                      return (
                        <li key={labor.id} className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5">
                            {formatDay(labor.workedOn)} · {formatDuration(seconds)}
                            <span className="text-muted-foreground"> · {labor.author}</span>
                            {labor.fromTimer ? (
                              <Timer
                                className="size-3.5 shrink-0 text-muted-foreground"
                                role="img"
                                aria-label="Rastreado pelo temporizador"
                              />
                            ) : null}
                          </span>
                          <button
                            type="button"
                            className="text-destructive"
                            aria-label="Remover tempo"
                            onClick={() => deleteWorkOrderLabor(record.id, labor.id).then(apply)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold">Arquivos</h3>
                {activity.files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum arquivo.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {activity.files.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-2">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-primary underline-offset-2 hover:underline"
                        >
                          {file.name}
                        </a>
                        <button
                          type="button"
                          className="text-destructive"
                          aria-label={`Remover ${file.name}`}
                          onClick={() => deleteWorkOrderFile(record.id, file.id).then(apply)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) => {
                        onFile(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                    />
                    <span className="inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium">
                      Adicionar foto
                    </span>
                  </label>
                  <label className="inline-flex">
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(event) => {
                        onFile(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                    />
                    <span className="inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium">
                      Adicionar arquivo
                    </span>
                  </label>
                </div>
              </section>
            </div>
          ) : (
            <Timeline order={record} />
          )}
        </div>
      </SheetContent>
    </Sheet>
    <FormDialog
      open={mailOpen}
      onOpenChange={setMailOpen}
      title="Enviar por e-mail"
      description="O destinatário recebe um botão para abrir esta ordem, sem precisar entrar no sistema."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          startMail(async () => {
            const result = await sendWorkOrderReport(record.id, mailTo, mailName);
            if (result.error) {
              setMailError(result.error);
              return;
            }
            setMailOpen(false);
          });
        }}
      >
        {mailError ? <p className="text-sm text-destructive">{mailError}</p> : null}
        <Input placeholder="Nome" value={mailName} onChange={(event) => setMailName(event.target.value)} className="h-9" />
        <Input type="email" required placeholder="E-mail" value={mailTo} onChange={(event) => setMailTo(event.target.value)} className="h-9" />
        <div className="flex justify-end">
          <Button type="submit" disabled={mailPending}>{mailPending ? <Loader2 className="animate-spin" /> : null}Enviar</Button>
        </div>
      </form>
    </FormDialog>
    <WorkOrderPartsDialog
      open={partsOpen}
      workOrderId={record.id}
      onOpenChange={setPartsOpen}
      onAdded={(next) => apply({ activity: next })}
    />
    <WorkOrderLaborDialog
      open={laborOpen}
      workOrderId={record.id}
      onOpenChange={setLaborOpen}
      onAdded={(next) => apply({ activity: next })}
    />
    <Dialog open={assetCloseOpen} onOpenChange={setAssetCloseOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status do ativo</DialogTitle>
          <DialogDescription>
            Ao concluir, registre o status do ativo e o momento em que ele passou a valer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <NativeSelect
            className="h-9"
            value={assetStatusValue}
            onChange={(event) => setAssetStatusValue(event.target.value)}
          >
            {ASSET_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
          <Input
            type="datetime-local"
            className="h-9"
            value={assetStatusAt}
            onChange={(event) => setAssetStatusAt(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => commitStatus("COMPLETE")}>
            Não alterar o ativo
          </Button>
          <Button
            type="button"
            disabled={busy || !assetStatusAt}
            onClick={() => {
              const at = new Date(assetStatusAt);
              if (Number.isNaN(at.getTime())) {
                setError("Data do status do ativo inválida.");
                return;
              }
              void commitStatus("COMPLETE", { status: assetStatusValue, at: at.toISOString() });
            }}
          >
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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

function Timeline({ order }: { order: WorkOrderRecord }) {
  const events = order.tasks
    .flatMap((task) => {
      if (!task.executedAt) return [];
      const answer = taskAnswerLabel(task);
      return [
        {
          id: `task-${task.id ?? task.label}`,
          at: task.executedAt,
          title: task.label,
          detail: [answer === "—" ? null : answer, task.comment].filter(Boolean).join(" — "),
        },
      ];
    })
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>;
  }

  return (
    <ol className="space-y-4 border-l pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" />
          <p className="text-sm font-semibold">{event.title}</p>
          <p className="text-xs text-muted-foreground">{formatWhen(event.at)}</p>
          {event.detail ? <p className="mt-1 text-sm whitespace-pre-wrap">{event.detail}</p> : null}
        </li>
      ))}
    </ol>
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
      className={cn(
        "h-8 px-3",
        active && "bg-background text-foreground shadow-sm hover:bg-background",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
