"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Loader2, MapPin, Package, Pencil, Phone, Trash2, UserRound, Wrench } from "lucide-react";
import { approveRequest, deleteRequests, rejectRequest } from "@/app/(app)/requests/actions";
import { RequestForm } from "@/components/requests/request-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestState } from "@/lib/requests/payload";
import type { RequestDetail } from "@/lib/requests/queries";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import type { WorkOrderEditorData } from "@/lib/work-orders/queries";

const whiteButton = "h-11 rounded-[10px] border border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white";
const card = "rounded-[14px] border border-[#14233a]/12 bg-white p-6";

const STATE_LABEL = {
  pending: "Pendente",
  treating: "Em tratamento",
  approved: "Aprovada",
  rejected: "Recusada",
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function RequestDetailView({
  request,
  tenantId,
  canEdit,
  isAdmin,
}: {
  request: RequestDetail;
  tenantId: string;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const state = requestState(request);
  const open = state === "pending" || state === "treating";
  const canDelete = (canEdit && open) || (isAdmin && state === "approved");
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<WorkOrderEditorData | null>(null);
  const [, startRefresh] = useTransition();

  async function approve() {
    setBusy(true);
    setError(null);
    const result = await approveRequest(request.id);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      startRefresh(() => router.refresh());
      return;
    }
    setEditor(result.editor);
    startRefresh(() => router.refresh());
  }

  async function reject() {
    setBusy(true);
    setError(null);
    const result = await rejectRequest(request.id, reason);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setRejecting(false);
    startRefresh(() => router.refresh());
  }

  async function remove() {
    const message = state === "approved"
      ? "Excluir esta solicitação aprovada? A ordem de serviço criada permanece."
      : "Excluir esta solicitação?";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    const result = await deleteRequests([request.id]);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push("/requests");
  }

  return (
    <div className="space-y-6 text-[#14233a]">
      <div className="flex flex-col gap-3.5">
        <Link href="/requests" className="inline-flex items-center gap-2 self-start font-medium text-[#4a5a70]">
          <ArrowLeft className="size-[18px]" />
          Voltar para as solicitações
        </Link>
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm text-[#4a5a70]">{request.customId ?? "Solicitação"}</span>
              <span className="inline-flex items-center rounded-full bg-[#f5f7fb] px-2.5 py-1 text-xs font-semibold text-[#4a5a70]">
                {STATE_LABEL[state]}
              </span>
            </div>
            <h1 className="mt-2.5 text-xl leading-tight font-semibold tracking-tight sm:text-2xl lg:text-[32px]">{request.title}</h1>
            {request.description ? <p className="mt-1.5 max-w-3xl text-base whitespace-pre-wrap text-[#4a5a70]">{request.description}</p> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2.5">
            {request.workOrderId ? (
              <Button asChild variant="outline" className={whiteButton}>
                <Link href={`/work-orders/${request.workOrderId}`}>Abrir ordem</Link>
              </Button>
            ) : null}
            {canEdit && open ? (
              <Button type="button" className="h-11 rounded-[10px]" disabled={busy} onClick={() => setEditing(true)}>
                <Pencil />
                Editar
              </Button>
            ) : null}
            {isAdmin && open ? (
              <Button type="button" className="h-11 rounded-[10px] bg-[#008300] text-white hover:bg-[#006b00]" disabled={busy} onClick={() => void approve()}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Aprovar
              </Button>
            ) : null}
            {isAdmin && open ? (
              <Button type="button" variant="outline" className={whiteButton} disabled={busy} onClick={() => setRejecting(true)}>
                Recusar
              </Button>
            ) : null}
            {canDelete ? (
              <Button type="button" variant="outline" aria-label="Excluir" className={`${whiteButton} size-11 px-0 text-[#b42323]`} disabled={busy} onClick={() => void remove()}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-[#b42323]">{error}</p> : null}
      {request.cancellationReason ? (
        <p className="text-sm text-[#4a5a70]">Motivo da recusa: {request.cancellationReason}</p>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2] basis-[560px] flex-col gap-5">
          <section className={card} aria-label="Foto">
            <h2 className="text-lg font-semibold tracking-tight">Foto</h2>
            <p className="text-[13px] text-[#4a5a70]">Imagem enviada com a solicitação</p>
            {request.imageUrl ? (
              <a href={request.imageUrl} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-[#14233a]/12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={request.imageUrl} alt="" className="max-h-80 w-full object-cover" />
              </a>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[#cbd5e1] px-4 py-6 text-sm text-[#4a5a70]">
                <Camera className="size-5" />
                Nenhuma foto nesta solicitação.
              </div>
            )}
          </section>
        </div>
        <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-5">
          <section className={card} aria-label="Informações">
            <h2 className="text-lg font-semibold">Informações</h2>
            <Info icon={<UserRound className="size-[18px]" />} label="Solicitante" value={request.requesterName} />
            <Info icon={<Phone className="size-[18px]" />} label="Telefone" value={request.requesterPhone} />
            <Info icon={<Package className="size-[18px]" />} label="Ativo" value={request.assetName} />
            <Info icon={<MapPin className="size-[18px]" />} label="Localização" value={request.locationName} />
            <Info icon={<Wrench className="size-[18px]" />} label="Quando" value={formatWhen(request.createdAt)} last />
          </section>
          {request.workOrderCustomId ? (
            <section className={card} aria-label="Ordem criada">
              <h2 className="text-lg font-semibold">Ordem criada</h2>
              <p className="mt-2 font-mono text-sm text-[#4a5a70]">{request.workOrderCustomId}</p>
            </section>
          ) : null}
        </div>
      </div>

      <FormDialog open={editing} onOpenChange={setEditing} title="Editar solicitação" description="Vale enquanto a solicitação estiver pendente ou em tratamento.">
        {editing ? (
          <RequestForm
            request={request}
            tenantId={tenantId}
            onCancel={() => setEditing(false)}
            onSuccess={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        ) : null}
      </FormDialog>
      <FormDialog open={rejecting} onOpenChange={setRejecting} title="Recusar solicitação" description="Informe o motivo. A solicitação deixa de ficar pendente.">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void reject();
          }}
        >
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} required placeholder="Motivo da recusa" rows={3} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => setRejecting(false)}>Cancelar</Button>
            <Button type="submit" className="h-9" disabled={busy}>{busy ? "Salvando..." : "Recusar"}</Button>
          </div>
        </form>
      </FormDialog>
      <FormDialog open={editor !== null} onOpenChange={(next) => { if (!next) setEditor(null); }} title="Completar ordem de serviço" description="A solicitação já virou esta ordem. Complete o que faltar.">
        {editor ? (
          <WorkOrderForm
            order={editor.order}
            locations={editor.locations}
            assets={editor.assets}
            people={editor.people}
            teams={editor.teams}
            checklists={editor.checklists}
            customers={editor.customers}
            onCancel={() => setEditor(null)}
            onSuccess={() => {
              setEditor(null);
              router.refresh();
            }}
          />
        ) : null}
      </FormDialog>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  last?: boolean;
}) {
  return (
    <div className={`mt-3 flex items-start gap-3.5 border-t border-[#e9edf3] py-3.5 ${last ? "pb-0" : ""}`}>
      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#eef3fb] text-[#0b1b33]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">{label}</div>
        <div className={`mt-0.5 text-[15px] ${value ? "font-semibold" : "text-[#5b6b80]"}`}>{value || "Não informado"}</div>
      </div>
    </div>
  );
}
