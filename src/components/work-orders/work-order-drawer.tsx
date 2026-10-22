"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileText, Loader2, Timer, Trash2, X } from "lucide-react";
import {
  addWorkOrderLabor,
  addWorkOrderUpdate,
  deleteWorkOrderFile,
  deleteWorkOrderLabor,
  deleteWorkOrderUpdate,
  loadWorkOrderActivity,
  registerWorkOrderFile,
  removeWorkOrderPart,
  setWorkOrderStatus,
  toggleWorkOrderTimer,
} from "@/app/(app)/work-orders/activity-actions";
import { WorkOrderPartsDialog } from "@/components/work-orders/work-order-parts-dialog";
import { printWorkOrderReport } from "@/components/work-orders/work-order-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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
  workOrderPriorityLabel,
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

function todayInput() {
  const date = new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function WorkOrderDrawer({
  orderId,
  order,
  tenantId,
  open,
  onOpenChange,
  onEdit,
  onAnswer,
}: {
  orderId: string | null;
  order: WorkOrderRecord | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: WorkOrderRecord) => void;
  onAnswer: (order: WorkOrderRecord) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"details" | "updates">("details");
  const [activity, setActivity] = useState<WorkOrderActivity>(EMPTY_ACTIVITY);
  const [loaded, setLoaded] = useState<WorkOrderRecord | null>(null);
  const [detailReady, setDetailReady] = useState(false);
  const [status, setStatus] = useState(order?.status ?? "OPEN");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [workedOn, setWorkedOn] = useState(todayInput);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [note, setNote] = useState("");
  const [partsOpen, setPartsOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || !open) return;
    setTab("details");
    setError(null);
    setNote("");
    setPartsOpen(false);
    setLoaded(null);
    setActivity(EMPTY_ACTIVITY);
    setDetailReady(false);
    let cancelled = false;
    loadWorkOrderActivity(orderId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        setDetailReady(true);
        return;
      }
      setActivity(result.activity);
      setLogoUrl(result.logoUrl ?? null);
      if (result.order) {
        setLoaded(result.order);
        setStatus(result.order.status);
      }
      setDetailReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  useEffect(() => {
    if (order && order.id === orderId) setStatus(order.status);
  }, [order, orderId]);

  useEffect(() => {
    if (!activity.timer?.startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activity.timer?.startedAt]);

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

  function apply(result: { error: string } | { activity: WorkOrderActivity }) {
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setActivity(result.activity);
  }

  async function changeStatus(next: string) {
    setStatus(next);
    setBusy(true);
    const result = await setWorkOrderStatus(record.id, next);
    setBusy(false);
    if ("error" in result) {
      setStatus(record.status);
      setError(result.error);
      return;
    }
    setError(null);
    router.refresh();
  }

  async function toggleTimer() {
    setBusy(true);
    const result = await toggleWorkOrderTimer(record.id);
    setBusy(false);
    apply(result);
  }

  async function addTime() {
    setBusy(true);
    const result = await addWorkOrderLabor(
      record.id,
      workedOn,
      Number(hours),
      Number(minutes),
    );
    setBusy(false);
    if (!("error" in result)) {
      setHours("0");
      setMinutes("0");
    }
    apply(result);
  }

  async function addNote() {
    setBusy(true);
    const result = await addWorkOrderUpdate(record.id, note);
    setBusy(false);
    if (!("error" in result)) setNote("");
    apply(result);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["pdf", "png", "jpg", "jpeg", "webp", "txt", "doc", "docx", "xls", "xlsx"];
    if (!allowed.includes(extension)) {
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
    const result = await registerWorkOrderFile(record.id, path, file.name);
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
          <SheetTitle className="text-xl font-bold">{record.title}</SheetTitle>
          {record.description ? (
            <p className="text-sm text-muted-foreground">{record.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => printWorkOrderReport(record, activity, logoUrl)}
            >
              <FileText />
              Relatório PDF
            </Button>
            <Button type="button" variant="ghost" className="h-9" onClick={() => onEdit(record)}>
              Editar
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex w-fit gap-1 rounded-lg bg-muted p-1">
            <TabButton active={tab === "details"} onClick={() => setTab("details")}>
              Detalhes
            </TabButton>
            <TabButton active={tab === "updates"} onClick={() => setTab("updates")}>
              Atualizações
            </TabButton>
          </div>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

          {tab === "details" ? (
            <div className="space-y-6">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Prioridade" value={workOrderPriorityLabel(record.priority)} />
                <Detail label="Vencimento" value={formatWhen(record.dueDate)} />
                <Detail label="Localização" value={record.locationName ?? "—"} />
                <Detail label="Ativo" value={record.assetName ?? "—"} />
                <Detail label="Trabalhador" value={record.primaryUserName ?? "—"} />
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
                    Responder tarefas
                  </Button>
                </div>
                {record.tasks.filter((task) => task.value).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa respondida.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {record.tasks
                      .filter((task) => task.value)
                      .map((task) => (
                        <li key={task.id ?? task.label} className="flex justify-between gap-3">
                          <span>{task.label}</span>
                          <span className="font-medium">{taskAnswerLabel(task)}</span>
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
                <h3 className="font-semibold">Mão de obra</h3>
                {activity.labors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum tempo lançado.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {activity.labors.map((labor) => (
                      <li key={labor.id} className="flex items-center justify-between gap-2">
                        <span>
                          {formatDay(labor.workedOn)} · {formatDuration(labor.durationSeconds)}
                          <span className="text-muted-foreground"> · {labor.author}</span>
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
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Data
                    <Input
                      type="date"
                      value={workedOn}
                      className="h-9"
                      onChange={(event) => setWorkedOn(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Horas
                    <Input
                      type="number"
                      min={0}
                      value={hours}
                      className="h-9 w-20"
                      onChange={(event) => setHours(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Min
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={minutes}
                      className="h-9 w-20"
                      onChange={(event) => setMinutes(event.target.value)}
                    />
                  </label>
                  <Button type="button" className="h-9" disabled={busy} onClick={addTime}>
                    Adicionar tempo
                  </Button>
                </div>
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
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              {activity.updates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum passo registrado.</p>
              ) : (
                <ol className="space-y-4 border-l pl-4">
                  {activity.updates.map((update) => (
                    <li key={update.id} className="relative">
                      <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{update.author}</p>
                          <p className="text-xs text-muted-foreground">{formatWhen(update.createdAt)}</p>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Excluir atualização"
                          onClick={() => deleteWorkOrderUpdate(record.id, update.id).then(apply)}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{update.body}</p>
                    </li>
                  ))}
                </ol>
              )}
              <Textarea
                value={note}
                rows={3}
                placeholder="O que foi feito"
                onChange={(event) => setNote(event.target.value)}
              />
              <Button type="button" className="h-9" disabled={busy || !note.trim()} onClick={addNote}>
                Adicionar atualização
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <WorkOrderPartsDialog
      open={partsOpen}
      workOrderId={record.id}
      options={activity.partOptions}
      onOpenChange={setPartsOpen}
      onAdded={(next) => apply({ activity: next })}
    />
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
