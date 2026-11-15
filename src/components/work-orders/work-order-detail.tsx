"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  Image as ImageIcon,
  ClipboardCheck,
  Flag,
  Loader2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Play,
  Plus,
  Timer,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  completeWorkOrder,
  deleteWorkOrderFile,
  deleteWorkOrderLabor,
  registerWorkOrderFile,
  removeWorkOrderPart,
  setWorkOrderStatus,
  toggleWorkOrderTimer,
} from "@/app/(app)/work-orders/activity-actions";
import { sendWorkOrderReport } from "@/app/(app)/work-orders/report-actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { PhotoSourcePicker } from "@/components/images/photo-source-picker";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { WorkOrderLaborDialog } from "@/components/work-orders/work-order-labor-dialog";
import { WorkOrderPartsDialog } from "@/components/work-orders/work-order-parts-dialog";
import { OpenWorkOrderReportButton } from "@/components/work-orders/open-work-order-report-button";
import { WorkOrderTaskDialog } from "@/components/work-orders/work-order-tasks-dialog";
import { ASSET_STATUSES } from "@/lib/assets/status";
import { compressWorkOrderPhoto, isWorkOrderPhotoName, WORK_ORDER_PHOTO_LIMIT } from "@/lib/images/compress-work-order-photo";
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
import { formatQuantity } from "@/lib/inventory/format";
import { formatBrl } from "@/lib/money/brl";
import { partsTotal, serviceCharge } from "@/lib/work-orders/billing";
import { workOrderCompleteBlock } from "@/lib/work-orders/completion";
import { createClient } from "@/lib/supabase/client";
import {
  formatDuration,
  formatDurationClock,
  liveDuration,
  type WorkOrderActivity,
  type WorkOrderLabor,
} from "@/lib/work-orders/activity";
import type { WorkOrderEditorData, WorkOrderRecord } from "@/lib/work-orders/queries";
import {
  WORK_ORDER_STATUSES,
  workOrderPriorityLabel,
  workOrderStatusColor,
  workOrderStatusLabel,
  workOrderStatusStyle,
  workOrderTypeLabel,
} from "@/lib/work-orders/status";
import { taskAnswerLabel } from "@/lib/work-orders/tasks";

const whiteButton =
  "h-11 rounded-[10px] border border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white";

const STEPS = [
  { status: "OPEN", label: "Aberta" },
  { status: "IN_PROGRESS", label: "Em andamento" },
  { status: "COMPLETE", label: "Concluída" },
] as const;

export function WorkOrderDetail({
  order: initialOrder,
  activity: initialActivity,
  tenantId,
  canEdit,
  canOperate,
  editor,
}: {
  order: WorkOrderRecord;
  activity: WorkOrderActivity;
  tenantId: string;
  canEdit: boolean;
  canOperate: boolean;
  editor: WorkOrderEditorData | null;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [activity, setActivity] = useState(initialActivity);
  const [status, setStatus] = useState(initialOrder.status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [partsOpen, setPartsOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  const [executingTask, setExecutingTask] = useState<(typeof initialOrder.tasks)[number] | null>(null);
  const [editing, setEditing] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [mailName, setMailName] = useState("");
  const [mailError, setMailError] = useState<string | null>(null);
  const [mailPending, startMail] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(initialOrder.status);
  const [assetCloseOpen, setAssetCloseOpen] = useState(false);
  const [assetStatusValue, setAssetStatusValue] = useState("OPERATIONAL");
  const [assetStatusAt, setAssetStatusAt] = useState("");

  useEffect(() => {
    setOrder(initialOrder);
    setActivity(initialActivity);
    setStatus(initialOrder.status);
  }, [initialOrder, initialActivity]);

  useEffect(() => {
    const runningClock = Boolean(activity.timer?.startedAt) || activity.labors.some((labor) => labor.startedAt);
    if (!runningClock) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activity.timer?.startedAt, activity.labors]);

  const running = Boolean(activity.timer?.startedAt);
  const timerLabel = formatDurationClock(liveDuration(activity.timer, now));
  const laborTotal = activity.labors.reduce((sum, labor) => sum + laborDuration(labor, now), 0);
  const answered = order.tasks.filter((task) => task.value).length;
  const displayTasks = order.tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      const leftAt = left.task.executedAt ? Date.parse(left.task.executedAt) : Number.POSITIVE_INFINITY;
      const rightAt = right.task.executedAt ? Date.parse(right.task.executedAt) : Number.POSITIVE_INFINITY;
      if (leftAt !== rightAt) return leftAt - rightAt;
      return left.index - right.index;
    })
    .map((item) => item.task);
  const due = splitWhen(order.dueDate);
  const closed = status === "COMPLETE";
  const step = closed ? 2 : status === "OPEN" ? 0 : 1;
  const statusStyle = workOrderStatusStyle(status);
  const charge = order.billingMode === "NONE" ? null : serviceCharge(order, activity);
  const partsValue = partsTotal(activity.parts);

  function apply(result: { error: string } | { activity: WorkOrderActivity; order?: WorkOrderRecord }) {
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setActivity(result.activity);
    if (result.order) {
      setOrder(result.order);
      setStatus(result.order.status);
    }
  }

  async function commitStatus(next: string, asset?: { status: string; at: string }) {
    setStatus(next);
    setBusy(true);
    const result = await setWorkOrderStatus(order.id, next, asset);
    setBusy(false);
    if ("error" in result) {
      setStatus(order.status);
      setError(result.error);
      return;
    }
    setError(null);
    setAssetCloseOpen(false);
    setOrder((current) => ({ ...current, status: next }));
    if (next === "COMPLETE") {
      const now = Date.now();
      setActivity((current) => ({
        ...current,
        timer: current.timer
          ? { ...current.timer, durationSeconds: liveDuration(current.timer, now), startedAt: null }
          : null,
        labors: current.labors.map((labor) =>
          labor.startedAt ? { ...labor, durationSeconds: laborDuration(labor, now), startedAt: null } : labor,
        ),
      }));
    }
    router.refresh();
  }

  const completeBlock = workOrderCompleteBlock({
    labors: activity.labors,
    tasks: order.tasks,
  });
  const photos = activity.files.filter((file) => isWorkOrderPhotoName(file.name));

  function openStatus() {
    setDraftStatus(status);
    setStatusOpen(true);
  }

  async function changeStatus(next: string) {
    if (next === "COMPLETE" && completeBlock) {
      setError(completeBlock);
      return;
    }
    if (next === "COMPLETE" && order.assetId && next !== order.status) {
      setAssetStatusValue("OPERATIONAL");
      setAssetStatusAt(toDatetimeLocal(new Date().toISOString()));
      setAssetCloseOpen(true);
      return;
    }
    await commitStatus(next);
  }

  async function onFile(file: File | null) {
    if (!file || uploading) return;
    const photos = activity.files.filter((item) => isWorkOrderPhotoName(item.name));
    if (photos.length >= WORK_ORDER_PHOTO_LIMIT) {
      setError("A ordem aceita no máximo 3 fotos.");
      return;
    }
    setUploading(true);
    setError(null);
    let path = "";
    const supabase = createClient();
    try {
      const photo = await compressWorkOrderPhoto(file);
      path = `${tenantId}/work-orders/${order.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(path, photo, { contentType: "image/jpeg", upsert: false });
      if (uploadError) {
        setError("Não foi possível enviar a foto.");
        return;
      }
      const result = await registerWorkOrderFile(order.id, path, photo.name);
      if ("error" in result) await supabase.storage.from("attachments").remove([path]);
      apply(result);
    } catch (error) {
      if (path) await supabase.storage.from("attachments").remove([path]);
      setError(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 text-[#14233a]">
      <div className="flex flex-col gap-3.5">
        <Link href="/work-orders" className="inline-flex items-center gap-2 self-start font-medium text-[#4a5a70]">
          <ArrowLeft className="size-[18px]" />
          Voltar para as ordens de serviço
        </Link>
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm text-[#4a5a70]">{order.customId ?? "Ordem de serviço"}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef3fb] px-2.5 py-1 text-xs font-semibold text-[#0b1b33]">
                <Wrench className="size-3.5" />
                {workOrderTypeLabel(order.type)}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(order.priority)}`}>
                <Flag className="size-3.5" />
                Prioridade {workOrderPriorityLabel(order.priority).toLowerCase()}
              </span>
            </div>
            <h1 className="mt-2.5 text-xl leading-tight font-semibold tracking-tight sm:text-2xl lg:text-[32px]">{order.title}</h1>
            {order.description ? <p className="mt-1.5 text-base text-[#4a5a70]">{order.description}</p> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2.5">
            {canOperate && !closed ? (
              <Button type="button" className="h-11 rounded-[10px] bg-[#008300] text-white hover:bg-[#006b00]" disabled={busy} onClick={() => { setBusy(true); void toggleWorkOrderTimer(order.id).then((result) => { setBusy(false); apply(result); }); }}>
                {busy ? <Loader2 className="animate-spin" /> : running ? (
                  <span className="relative flex size-2.5" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-white" />
                  </span>
                ) : <Play />}
                {running ? `Pausar · ${timerLabel}` : "Iniciar OS"}
              </Button>
            ) : null}
            {closed ? (
              <>
                <OpenWorkOrderReportButton workOrderId={order.id} className={whiteButton} />
                <Button
                  type="button"
                  variant="outline"
                  className={whiteButton}
                  onClick={() => {
                    setMailTo(order.customerEmail ?? "");
                    setMailName(order.customerName ?? "");
                    setMailError(null);
                    setMailOpen(true);
                  }}
                >
                  <Mail /> Enviar por e-mail
                </Button>
              </>
            ) : null}
            {canEdit && editor ? (
              <Button type="button" className="h-11 rounded-[10px]" onClick={() => setEditing(true)}>
                <Pencil /> Editar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-[#b42323]">{error}</p> : null}

      <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-4 sm:p-6" aria-label="Andamento da OS">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Andamento</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {canEdit ? (
              <button
                type="button"
                disabled={busy}
                onClick={openStatus}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${statusStyle.chip}`}
              >
                <span className={`size-2 rounded-full ${statusStyle.dot}`} />
                {workOrderStatusLabel(status)}
              </button>
            ) : (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle.chip}`}>
                <span className={`size-2 rounded-full ${statusStyle.dot}`} />
                {workOrderStatusLabel(status)}
              </span>
            )}
            {canOperate && !canEdit && !closed ? (
              <Button type="button" className="h-11 rounded-[10px]" disabled={busy || Boolean(completeBlock)} onClick={() => { setBusy(true); void completeWorkOrder(order.id).then((result) => { setBusy(false); apply(result); }); }}>
                Concluir OS
              </Button>
            ) : null}
          </div>
        </div>
        {canOperate && !canEdit && !closed && completeBlock ? <p className="-mt-3 mb-4 text-sm text-[#4a5a70]">{completeBlock}</p> : null}
        <div className="mx-auto mb-7 flex max-w-[760px] items-start" role="group" aria-label="Etapas da OS">
          {STEPS.map((item, index) => {
            const current = index === step;
            const reached = index <= step;
            const tone = closed ? "#008300" : "#2a78d6";
            return (
            <div key={item.status} className="contents">
              {index > 0 ? <div className="mt-3.5 h-[3px] w-3 shrink-0 rounded-sm sm:w-auto sm:min-w-4 sm:flex-1" style={{ background: reached ? tone : "#e9edf3" }} /> : null}
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center sm:gap-2">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${reached ? "text-white" : "border border-[#cbd5e1] text-[#5b6b80]"}`}
                  style={reached ? { background: tone, boxShadow: current ? `0 0 0 5px color-mix(in srgb, ${tone} 18%, transparent)` : undefined } : undefined}
                >
                  {index < step || closed ? <Check className="size-[18px]" strokeWidth={3} /> : <span className="size-2 rounded-full bg-current" />}
                </span>
                <span className={`text-xs leading-tight sm:text-sm ${current ? "font-bold" : "font-semibold"}`}>{item.label}</span>
                {current ? <span className="-mt-0.5 text-[11px] font-semibold leading-tight text-[#14233a] sm:text-xs">{status === "ON_HOLD" ? "Pausado" : "Etapa atual"}</span> : null}
              </div>
            </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat label="Vencimento" value={due.day} note={due.time} />
          <Stat label="Tempo registrado" value={running ? formatDurationClock(laborTotal) : formatDuration(laborTotal)} note={activity.labors.length === 1 ? "1 lançamento" : `${activity.labors.length} lançamentos`} />
          <Stat label="Tarefas" value={`${answered} de ${order.tasks.length}`} note={answered === order.tasks.length && order.tasks.length > 0 ? "respondidas" : "em aberto"} />
          <Stat label="Peças" value={String(activity.parts.length)} note={activity.parts.length === 0 ? "nenhuma utilizada" : "utilizadas"} />
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2] basis-[560px] flex-col gap-5">
          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-4 sm:p-5" aria-label="Tarefas">
            <div className="mb-3">
              <h2 className="text-base font-semibold tracking-tight">Tarefas</h2>
              <p className="text-xs text-[#4a5a70]">{answered} de {order.tasks.length} respondida{answered === 1 ? "" : "s"}</p>
            </div>
            {displayTasks.length === 0 ? <EmptyBox icon={<ClipboardCheck className="size-5" />} text="Esta ordem não tem tarefas." /> : (
              <ul>
                {displayTasks.map((task, index) => {
                  const canExecute = canOperate && !closed && Boolean(task.id);
                  return (
                  <li key={task.id ?? task.label} className="flex gap-2.5">
                    <div className="flex w-6 flex-none flex-col items-center">
                      <span className={`flex size-6 items-center justify-center rounded-full ${task.value ? "bg-[#008300] text-white" : "border border-[#cbd5e1] bg-white"}`}>
                        {task.value ? <Check className="size-3.5" strokeWidth={3} /> : null}
                      </span>
                      {index < displayTasks.length - 1 ? <span className="w-0.5 flex-1 bg-[#cbd5e1]" /> : null}
                    </div>
                    <button
                      type="button"
                      disabled={!canExecute}
                      onClick={() => {
                        if (task.id) setExecutingTask(task);
                      }}
                      className={`min-w-0 flex-1 text-left ${index < displayTasks.length - 1 ? "pb-3" : ""} ${canExecute ? "cursor-pointer rounded-lg hover:bg-[#fafbfc]" : ""}`}
                    >
                      <div className="text-sm font-semibold">{task.label}</div>
                      {task.value ? (
                        <div className="mt-1.5 rounded-lg bg-[#f8f9fb] px-3 py-2">
                          <div className="text-[11px] font-semibold tracking-wide text-[#5b6b80] uppercase">Resposta</div>
                          <div className="mt-0.5 text-[13px]">{taskAnswerLabel(task)}{task.comment ? ` — ${task.comment}` : ""}</div>
                        </div>
                      ) : <p className="mt-0.5 text-xs text-[#4a5a70]">Pendente</p>}
                      {task.executedAt ? <div className="mt-1 text-xs text-[#4a5a70]">Respondida em {formatWhen(task.executedAt)}</div> : null}
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Mão de obra">
            <SectionHead title="Mão de obra" subtitle="Tempo trabalhado por técnico">
              {canOperate && !closed ? (
                <Button type="button" variant="outline" className={whiteButton} onClick={() => setLaborOpen(true)}><Plus /> Adicionar tempo</Button>
              ) : null}
            </SectionHead>
            {activity.labors.length === 0 ? <EmptyBox icon={<Timer className="size-5" />} text="Nenhum tempo lançado." /> : (
              <>
                <div className="hidden gap-5 pb-2 text-xs font-semibold tracking-wide text-[#5b6b80] uppercase sm:flex">
                  <div className="min-w-[110px] flex-1">Data</div>
                  <div className="min-w-[170px] flex-[1.4]">Técnico</div>
                  <div className="w-28">Tempo</div>
                  <div className="w-[130px]">Origem</div>
                  <div className="w-11" />
                </div>
                {activity.labors.map((labor) => (
                  <div key={labor.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e9edf3] py-2">
                    <div className="min-w-[110px] flex-1 text-[15px]">{formatDay(labor.workedOn)}</div>
                    <div className="flex min-w-[170px] flex-[1.4] items-center gap-2.5 text-[15px]">
                      <span className="flex size-8 items-center justify-center rounded-full bg-[#dbe7fa] text-xs font-bold text-[#0b1b33]">{initials(labor.author)}</span>
                      {labor.author}
                    </div>
                    <div className="w-28 font-mono text-sm">{labor.startedAt ? formatDurationClock(laborDuration(labor, now)) : formatDuration(labor.durationSeconds)}</div>
                    <div className="w-[130px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f7fb] px-2.5 py-0.5 text-xs font-semibold text-[#4a5a70]">
                        <Timer className="size-3.5" />{labor.fromTimer ? "Temporizador" : "Manual"}
                      </span>
                    </div>
                    {canOperate && !closed ? (
                      <button type="button" className="flex size-11 items-center justify-center rounded-[10px] text-[#b42323] hover:bg-[rgba(208,59,59,0.11)]" aria-label={`Remover lançamento de ${formatDay(labor.workedOn)}`} onClick={() => deleteWorkOrderLabor(order.id, labor.id).then(apply)}>
                        <Trash2 className="size-[18px]" />
                      </button>
                    ) : null}
                  </div>
                ))}
                <div className="flex justify-end gap-3 border-t border-[#e9edf3] pt-3 text-[15px]">
                  <span className="text-[#4a5a70]">Total registrado</span>
                  <span className="font-mono font-medium">{running ? formatDurationClock(laborTotal) : formatDuration(laborTotal)}</span>
                </div>
              </>
            )}
            {charge != null ? (
              <p className="mt-3 text-right text-[15px] text-[#4a5a70]">
                Serviço <span className="font-semibold text-[#14233a]">{formatBrl(charge)}</span>
              </p>
            ) : null}
          </section>

          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Peças">
            <SectionHead title="Peças" subtitle="Itens do inventário usados nesta ordem">
              {canOperate && !closed ? (
                <Button type="button" variant="outline" className={whiteButton} onClick={() => setPartsOpen(true)}><Plus /> Adicionar peças</Button>
              ) : null}
            </SectionHead>
            {activity.parts.length === 0 ? <EmptyBox icon={<Package className="size-5" />} text="Nenhuma peça nesta ordem." /> : (
              <ul className="space-y-2">
                {activity.parts.map((part) => (
                  <li key={part.id} className="flex items-center justify-between gap-3 border-t border-[#e9edf3] py-2.5 text-[15px]">
                    <span>{part.name}<span className="text-[#4a5a70]"> · {formatQuantity(part.quantity, part.unit)} · {formatBrl(part.cost * part.quantity)}</span></span>
                    {canOperate && !closed ? (
                      <button type="button" className="flex size-11 items-center justify-center rounded-[10px] text-[#b42323] hover:bg-[rgba(208,59,59,0.11)]" aria-label={`Remover ${part.name}`} onClick={() => removeWorkOrderPart(order.id, part.id).then(apply)}>
                        <Trash2 className="size-[18px]" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {activity.parts.length > 0 ? (
              <p className="mt-3 text-right text-[15px] text-[#4a5a70]">
                Peças <span className="font-semibold text-[#14233a]">{formatBrl(partsValue)}</span>
              </p>
            ) : null}
          </section>

          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Valor total">
            <h2 className="text-lg font-semibold tracking-tight">Valor total</h2>
            <p className="text-[13px] text-[#4a5a70]">Serviço e peças desta ordem</p>
            <div className="mt-4 space-y-2.5 text-[15px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#4a5a70]">Serviço</span>
                <span>{charge == null ? "Sem cobrança" : formatBrl(charge)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#4a5a70]">Peças</span>
                <span>{formatBrl(partsValue)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[#e9edf3] pt-3 text-lg font-semibold">
                <span>Total</span>
                <span>{formatBrl((charge ?? 0) + partsValue)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-5">
          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Informações">
            <h2 className="text-lg font-semibold">Informações</h2>
            <Info icon={<Building2 className="size-[18px]" />} label="Cliente" value={order.customerName ?? "—"} note={order.customerPhone} />
            <Info icon={<Package className="size-[18px]" />} label="Ativo" value={order.assetName ?? "—"} />
            <Info icon={<MapPin className="size-[18px]" />} label="Localização" value={order.locationName ?? "—"} />
            <Info icon={<Building2 className="size-[18px]" />} label="Empresa" value={order.companyName || "—"} last />
          </section>
          <section className="rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Responsáveis">
            <h2 className="text-lg font-semibold">Responsáveis</h2>
            {order.assignees.length === 0 ? <p className="mt-3 text-sm text-[#4a5a70]">Nenhum responsável.</p> : order.assignees.map((person, index) => (
              <div key={person.id} className={`flex items-center gap-3 py-3 ${index === 0 ? "mt-3 border-t border-[#e9edf3]" : "border-t border-[#e9edf3]"}`}>
                <span className="flex size-9 items-center justify-center rounded-full bg-[#dbe7fa] text-[13px] font-bold text-[#0b1b33]">{initials(person.name)}</span>
                <span className="text-[15px] font-medium">{person.name}</span>
              </div>
            ))}
          </section>
          <section className="min-w-0 rounded-[14px] border border-[#14233a]/12 bg-white p-6" aria-label="Fotos">
            <SectionHead title="Fotos" subtitle="Até 3 fotos, com no máximo 2 MB cada">
              {canOperate && photos.length < WORK_ORDER_PHOTO_LIMIT ? (
                <PhotoSourcePicker disabled={uploading} onFile={onFile}>
                  {({ phone, openGallery, openCamera }) =>
                    phone ? (
                      <span className="inline-flex flex-wrap gap-2">
                        <button type="button" className={photoButton} disabled={uploading} onClick={openGallery}>
                          <ImageIcon className="size-[18px]" /> Galeria
                        </button>
                        <button type="button" className={photoButton} disabled={uploading} onClick={openCamera}>
                          {uploading ? <Loader2 className="size-[18px] animate-spin" /> : <Camera className="size-[18px]" />} Câmera
                        </button>
                      </span>
                    ) : (
                      <button type="button" className={photoButton} disabled={uploading} onClick={openGallery}>
                        {uploading ? <Loader2 className="size-[18px] animate-spin" /> : <Camera className="size-[18px]" />}
                        {uploading ? "Enviando" : "Adicionar foto"}
                      </button>
                    )
                  }
                </PhotoSourcePicker>
              ) : null}
            </SectionHead>
            {photos.length === 0 ? <EmptyBox icon={<Camera className="size-5" />} text="Nenhuma foto nesta ordem." /> : (
              <ul className="space-y-2.5">
                {photos.map((file) => (
                  <li key={file.id} className="flex min-w-0 items-center gap-3.5 overflow-hidden rounded-xl border border-[#14233a]/12 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.url} alt="" className="size-14 flex-none rounded-[10px] object-cover" />
                    <div className="min-w-0 flex-1">
                      <a href={file.url} target="_blank" rel="noreferrer" title={file.name} className="block truncate text-[15px] font-semibold text-[#2a78d6]">{file.name}</a>
                      <div className="text-[13px] text-[#4a5a70]">Imagem</div>
                    </div>
                    {canOperate ? (
                      <button type="button" className="flex size-11 flex-none items-center justify-center rounded-[10px] text-[#b42323] hover:bg-[rgba(208,59,59,0.11)]" aria-label={`Remover foto ${file.name}`} onClick={() => deleteWorkOrderFile(order.id, file.id).then(apply)}>
                        <Trash2 className="size-[18px]" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <WorkOrderTaskDialog
        order={executingTask ? order : null}
        task={executingTask?.id ? { ...executingTask, id: executingTask.id } : null}
        onOpenChange={(open) => {
          if (!open) setExecutingTask(null);
        }}
        onExecuted={(next) => {
          setOrder(next);
          setExecutingTask(null);
        }}
      />
      <WorkOrderPartsDialog open={partsOpen} workOrderId={order.id} onOpenChange={setPartsOpen} onAdded={(next) => apply({ activity: next })} />
      <WorkOrderLaborDialog open={laborOpen} workOrderId={order.id} onOpenChange={setLaborOpen} onAdded={(next) => apply({ activity: next })} />
      {editor ? (
        <FormDialog open={editing} onOpenChange={setEditing} title="Editar ordem" description={order.customId ?? undefined}>
          <WorkOrderForm
            order={order}
            locations={editor.locations}
            assets={editor.assets}
            people={editor.people}
            teams={editor.teams}
            checklists={editor.checklists}
            customers={editor.customers}
            onCancel={() => setEditing(false)}
            onSuccess={() => { setEditing(false); router.refresh(); }}
          />
        </FormDialog>
      ) : null}
      <FormDialog open={mailOpen} onOpenChange={setMailOpen} title="Enviar por e-mail" description="O destinatário recebe um botão para abrir esta ordem, sem precisar entrar no sistema.">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); startMail(async () => { const result = await sendWorkOrderReport(order.id, mailTo, mailName); if (result.error) { setMailError(result.error); return; } setMailOpen(false); }); }}>
          {mailError ? <p className="text-sm text-destructive">{mailError}</p> : null}
          <Input placeholder="Nome" value={mailName} onChange={(event) => setMailName(event.target.value)} className="h-9" />
          <Input type="email" required placeholder="E-mail" value={mailTo} onChange={(event) => setMailTo(event.target.value)} className="h-9" />
          <div className="flex justify-end"><Button type="submit" disabled={mailPending}>{mailPending ? <Loader2 className="animate-spin" /> : null}Enviar</Button></div>
        </form>
      </FormDialog>
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status</DialogTitle>
            <DialogDescription>Escolha a etapa desta ordem de serviço.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {WORK_ORDER_STATUSES.map((item) => {
              const blocked = item.value === "COMPLETE" && completeBlock;
              const selected = draftStatus === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={Boolean(blocked)}
                  onClick={() => setDraftStatus(item.value)}
                  className={`flex w-full items-start gap-3 rounded-[10px] border px-3 py-3 text-left ${selected ? "border-[#5569ff] bg-[#eef1ff]" : "border-[#cbd5e1] bg-white"} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: workOrderStatusColor(item.value) }} />
                  <span>
                    <span className="block font-semibold">{item.label}</span>
                    {blocked ? <span className="mt-0.5 block text-sm text-[#4a5a70]">{completeBlock}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={busy || (draftStatus === "COMPLETE" && Boolean(completeBlock))}
              onClick={() => {
                setStatusOpen(false);
                if (draftStatus !== status) void changeStatus(draftStatus);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={assetCloseOpen} onOpenChange={setAssetCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Status do ativo</DialogTitle>
            <DialogDescription>Ao concluir, registre o status do ativo e o momento em que ele passou a valer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <NativeSelect className="h-9" value={assetStatusValue} onChange={(event) => setAssetStatusValue(event.target.value)}>
              {ASSET_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </NativeSelect>
            <Input type="datetime-local" className="h-9" value={assetStatusAt} onChange={(event) => setAssetStatusAt(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => commitStatus("COMPLETE")}>Não alterar o ativo</Button>
            <Button type="button" disabled={busy || !assetStatusAt} onClick={() => {
              const at = new Date(assetStatusAt);
              if (Number.isNaN(at.getTime())) { setError("Data do status do ativo inválida."); return; }
              void commitStatus("COMPLETE", { status: assetStatusValue, at: at.toISOString() });
            }}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionHead({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-[13px] text-[#4a5a70]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f5f7fb] px-3 py-3 sm:px-[18px] sm:py-4">
      <div className="text-[13px] font-medium text-[#5b6b80]">{label}</div>
      <div className="mt-1 text-base font-semibold tracking-tight whitespace-nowrap sm:text-xl lg:text-2xl">{value}</div>
      {note ? <div className="text-[13px] text-[#4a5a70]">{note}</div> : null}
    </div>
  );
}

function Info({ icon, label, value, note, last }: { icon: ReactNode; label: string; value: string; note?: string | null; last?: boolean }) {
  return (
    <div className={`flex items-start gap-3.5 py-3.5 ${last ? "border-t border-[#e9edf3] pb-0" : "border-t border-[#e9edf3]"} mt-3 first:mt-3`}>
      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#eef3fb] text-[#0b1b33]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">{label}</div>
        <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
        {note ? <div className="text-sm text-[#4a5a70]">{note}</div> : null}
      </div>
    </div>
  );
}

function EmptyBox({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-[#cbd5e1] p-5">
      <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-[#f5f7fb] text-[#5b6b80]">{icon}</span>
      <span className="text-[15px] text-[#4a5a70]">{text}</span>
    </div>
  );
}

const photoButton = `inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-60 ${whiteButton}`;

function laborDuration(labor: WorkOrderLabor, now: number) {
  if (!labor.startedAt) return labor.durationSeconds;
  return liveDuration({ durationSeconds: labor.durationSeconds, startedAt: labor.startedAt, hourlyRate: labor.hourlyRate }, now);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function priorityClass(priority: string) {
  if (priority === "HIGH") return "bg-[rgba(208,59,59,0.11)] text-[#b42323]";
  if (priority === "MEDIUM") return "bg-[rgba(250,178,25,0.22)] text-[#8a5600]";
  if (priority === "LOW") return "bg-[rgba(12,163,12,0.11)] text-[#006300]";
  return "bg-[#f5f7fb] text-[#4a5a70]";
}

function splitWhen(value: string | null) {
  if (!value) return { day: "—", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "—", time: "" };
  return {
    day: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date),
    time: `às ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(date)}`,
  };
}

function parseWhen(value: string) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  return new Date(value);
}

function formatDay(value: string | null) {
  if (!value) return "—";
  const date = parseWhen(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = parseWhen(value);
  if (Number.isNaN(date.getTime())) return "—";
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date)
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
