"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  MapPin,
  Pencil,
  Plus,
  Shield,
  Zap,
} from "lucide-react";
import { setAssetStatus } from "@/app/(app)/assets/actions";
import { AssetForm } from "@/components/assets/asset-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { TablePagination } from "@/components/lists/table-pagination";
import { Button } from "@/components/ui/button";
import { ASSET_STATUSES, assetStatusColor, assetStatusLabel } from "@/lib/assets/status";
import type { AssetDetail } from "@/lib/assets/detail";
import {
  ASSET_HISTORY_PAGE_SIZE,
  assetDetailHref,
  type AssetHistoryQuery,
  type AssetHistoryType,
} from "@/lib/assets/history-params";
import type { AssetCategory } from "@/lib/categories/queries";
import type { LocationOption } from "@/lib/locations/queries";
import { formatBrl } from "@/lib/money/brl";
import { formatDuration } from "@/lib/work-orders/activity";
import { WORK_ORDER_STATUSES, workOrderStatusLabel, workOrderTypeLabel } from "@/lib/work-orders/status";

const whiteButton = "h-11 rounded-[10px] border border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white";
const card = "rounded-[14px] border border-[#14233a]/12 bg-white p-6";

const ORDER_STATUS_STYLE: Record<string, { chip: string; dot: string; bar: string }> = {
  OPEN: { chip: "bg-[#e7f0fc] text-[#1c5cab]", dot: "bg-[#2a78d6]", bar: "#2a78d6" },
  IN_PROGRESS: { chip: "bg-[#eef3fb] text-[#0b1b33]", dot: "bg-[#0b1b33]", bar: "#0b1b33" },
  ON_HOLD: { chip: "bg-[rgba(250,178,25,0.22)] text-[#8a5600]", dot: "bg-[#eda100]", bar: "#eda100" },
  COMPLETE: { chip: "bg-[rgba(12,163,12,0.11)] text-[#006300]", dot: "bg-[#008300]", bar: "#008300" },
};

export function AssetDetailView({
  detail,
  history,
  locations,
  categories,
  canManageCategories,
  canEdit,
  canCreateOrder,
  tenantId,
}: {
  detail: AssetDetail;
  history: AssetHistoryQuery;
  locations: LocationOption[];
  categories: AssetCategory[];
  canManageCategories: boolean;
  canEdit: boolean;
  canCreateOrder: boolean;
  tenantId: string;
}) {
  const router = useRouter();
  const asset = detail.asset;
  const [status, setStatus] = useState(asset.status);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startNavigation] = useTransition();

  useEffect(() => {
    setStatus(asset.status);
  }, [asset.status]);

  function visit(next: { page?: number; type?: AssetHistoryType | null }) {
    const type = "type" in next ? (next.type ?? null) : history.type;
    const page = next.page ?? ("type" in next ? 1 : history.page);
    startNavigation(() => {
      router.push(assetDetailHref(asset.id, { type, page }), { scroll: false });
    });
  }

  async function changeStatus(next: string) {
    const previous = status;
    setStatus(next);
    setStatusError(null);
    setStatusBusy(true);
    const result = await setAssetStatus(asset.id, next);
    setStatusBusy(false);
    if (result?.error) {
      setStatus(previous);
      setStatusError(result.error);
      return;
    }
    router.refresh();
  }

  const place = [asset.locationName, asset.area].filter(Boolean).join(" · ");
  const availability = formatAvailability(detail.availability);
  const ratio = formatTimes(detail.maintenanceCost, asset.acquisitionCost);
  const maxCost = detail.costLeaders[0]?.total ?? 0;
  const hiddenWithCost = Math.max(0, detail.workOrderCount - detail.zeroCostCount - detail.costLeaders.length);
  const costNotes = [
    hiddenWithCost > 0
      ? `E mais ${hiddenWithCost} ${hiddenWithCost === 1 ? "ordem" : "ordens"} com custo.`
      : null,
    detail.zeroCostCount > 0 && detail.costLeaders.length > 0
      ? detail.zeroCostCount === 1
        ? "A outra OS não tem custo lançado."
        : `As outras ${detail.zeroCostCount} OS não têm custo lançado.`
      : null,
  ].filter((note): note is string => note != null);
  const statusSegments = WORK_ORDER_STATUSES.flatMap((item) => {
    const count = detail.statusCounts[item.value] ?? 0;
    if (count <= 0) return [];
    const style = ORDER_STATUS_STYLE[item.value] ?? ORDER_STATUS_STYLE.OPEN;
    return [{ ...item, count, bar: style.bar }];
  });
  const filters: { type: AssetHistoryType | null; label: string; count: number }[] = [
    { type: null, label: "Todas", count: detail.workOrderCount },
    { type: "CORRECTIVE", label: "Corretivas", count: detail.correctiveCount },
    { type: "PREVENTIVE", label: "Preventivas", count: detail.preventiveCount },
    ...(detail.predictiveCount > 0 || history.type === "PREDICTIVE"
      ? [{ type: "PREDICTIVE" as const, label: "Preditivas", count: detail.predictiveCount }]
      : []),
  ];

  return (
    <div className={`flex flex-col gap-6 text-[#14233a] ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-3.5">
        <nav aria-label="Caminho" className="flex items-center gap-2 text-[15px]">
          <Link href="/assets" className="font-medium text-[#4a5a70] no-underline">
            Ativos
          </Link>
          <ChevronRight className="size-4 text-[#5b6b80]" aria-hidden="true" />
          <span className="font-mono font-medium">{asset.customId ?? "Ativo"}</span>
        </nav>
        <Link href="/assets" className="inline-flex min-h-8 items-center gap-2 self-start font-medium text-[#4a5a70]">
          <ArrowLeft className="size-[18px]" />
          Voltar para os ativos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-[1_1_420px]">
            <div className="flex flex-wrap items-center gap-2.5">
              {asset.customId ? <span className="font-mono text-sm text-[#4a5a70]">{asset.customId}</span> : null}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${assetChipClass(status)}`}>
                {status === "OPERATIONAL" ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-2 rounded-full" style={{ background: assetStatusColor(status) }} />}
                {assetStatusLabel(status)}
              </span>
              {asset.categoryName ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef3fb] px-2.5 py-1 text-xs font-semibold text-[#0b1b33]">
                  <Zap className="size-3.5" />
                  {asset.categoryName}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2.5 text-[32px] leading-tight font-semibold tracking-tight">{asset.name}</h1>
            {place ? <p className="mt-1.5 text-base text-[#4a5a70]">{place}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {canCreateOrder ? (
              <Button asChild variant="outline" className={whiteButton}>
                <Link href={`/work-orders?asset=${asset.id}`}>
                  <Plus />
                  Abrir nova OS
                </Link>
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" className="h-11 rounded-[10px]" onClick={() => setEditing(true)}>
                <Pencil />
                Editar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <section className={card} aria-label="Confiabilidade">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Confiabilidade</h2>
            <p className="text-[13px] text-[#4a5a70]">Disponibilidade e paradas do ativo</p>
          </div>
          {canEdit ? (
            <label className="relative inline-flex min-w-[220px]">
              <span className="pointer-events-none absolute top-1/2 left-4 size-2.5 -translate-y-1/2 rounded-full" style={{ background: assetStatusColor(status) }} />
              <select
                className="h-11 w-full appearance-none rounded-[10px] border border-[#cbd5e1] bg-white pr-10 pl-9 text-sm font-semibold outline-none focus-visible:border-[#2a78d6] focus-visible:ring-2 focus-visible:ring-[#2a78d6]"
                value={status}
                disabled={statusBusy}
                aria-label={`Alterar status do ativo. Status atual: ${assetStatusLabel(status)}`}
                onChange={(event) => {
                  void changeStatus(event.target.value);
                }}
              >
                {ASSET_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-[18px] -translate-y-1/2" />
            </label>
          ) : (
            <span className="inline-flex h-11 min-w-[220px] items-center gap-2.5 rounded-[10px] border border-[#cbd5e1] px-4 text-sm font-semibold">
              <span className="size-2.5 rounded-full" style={{ background: assetStatusColor(status) }} />
              {assetStatusLabel(status)}
            </span>
          )}
        </div>
        {statusError ? <p className="mb-4 text-sm text-[#b42323]">{statusError}</p> : null}
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1 rounded-xl bg-[#f5f7fb] px-[18px] py-4">
            <div className="text-[13px] font-medium text-[#5b6b80]">Disponibilidade</div>
            <div className={`mt-1 text-2xl font-semibold tracking-tight ${availability == null ? "text-[#5b6b80]" : ""}`}>
              {availability ?? "—"}
            </div>
            <div className="my-2 h-1.5 rounded-sm bg-[#e9edf3]">
              <div
                className="h-full rounded-sm"
                style={{
                  width: detail.availability == null ? "0%" : `${Math.round(detail.availability * 1000) / 10}%`,
                  background: availabilityColor(detail.availability),
                }}
              />
            </div>
            <div className="text-[13px] text-[#4a5a70]">do tempo em operação</div>
          </div>
          <Stat label="Tempo parado" value={formatDuration(detail.downtimeSeconds)} note="acumulado" />
          <Stat label="MTTR" value={detail.mttrSeconds == null ? "—" : formatDuration(detail.mttrSeconds)} note="Tempo médio de reparo" muted={detail.mttrSeconds == null} />
          <Stat label="MTBF" value={detail.mtbfSeconds == null ? "—" : formatDuration(detail.mtbfSeconds)} note="Tempo médio entre falhas" muted={detail.mtbfSeconds == null} />
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2] basis-[560px] flex-col gap-5">
          <section className={card} aria-label="Manutenção e custos">
            <SectionHead title="Manutenção e custos" subtitle="Custo acumulado das ordens deste ativo" />
            <div className="mb-6 flex flex-wrap gap-4">
              <Stat label="Ordens" value={String(detail.workOrderCount)} note={typeSummary(detail)} />
              <div className="min-w-[240px] flex-[1.5] rounded-xl bg-[#f5f7fb] px-[18px] py-4">
                <div className="text-[13px] font-medium text-[#5b6b80]">Custo de manutenção</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{formatBrl(detail.maintenanceCost)}</div>
                <div className="text-[13px] text-[#4a5a70]">
                  peças {formatBrl(detail.partsCost)} · mão de obra {formatBrl(detail.laborCost)}
                </div>
              </div>
              <Stat
                label="Manutenção ÷ aquisição"
                value={ratio ?? "—"}
                note={asset.acquisitionCost != null && asset.acquisitionCost > 0 ? `de ${formatBrl(asset.acquisitionCost)} de aquisição` : "custo de aquisição não informado"}
                muted={ratio == null}
              />
            </div>
            <div className="mb-3 text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">Custo por OS</div>
            {detail.costLeaders.length === 0 ? (
              <p className="text-sm text-[#4a5a70]">Nenhuma ordem tem custo lançado.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {detail.costLeaders.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                      <span>
                        {item.customId ? <span className="font-mono text-[#4a5a70]">{item.customId}</span> : null}
                        {item.customId ? " · " : ""}
                        {item.title}
                      </span>
                      <span className="font-semibold">{formatBrl(item.total)}</span>
                    </div>
                    <div className="h-2.5 rounded-[5px] bg-[#e9edf3]">
                      <div
                        className="h-full min-w-1 rounded-[5px] bg-[#2a78d6]"
                        style={{ width: maxCost > 0 ? `${Math.max(2, (item.total / maxCost) * 100)}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {costNotes.length > 0 ? <p className="mt-4 text-[13px] text-[#4a5a70]">{costNotes.join(" ")}</p> : null}
          </section>

          <section className={card} aria-label="Histórico de manutenção">
            <SectionHead title="Histórico de manutenção" subtitle="Todas as OS deste ativo, da mais recente para a mais antiga" />
            <div className="mb-4 flex flex-wrap gap-2">
              {filters.map((filter) => {
                const active = history.type === filter.type;
                return (
                  <button
                    key={filter.label}
                    type="button"
                    aria-pressed={active}
                    className={`inline-flex h-11 items-center rounded-full border bg-white px-4 text-sm font-semibold hover:bg-white ${active ? "border-primary text-primary" : "border-[#cbd5e1] text-[#14233a]"}`}
                    onClick={() => visit({ type: filter.type })}
                  >
                    {filter.label} ({filter.count})
                  </button>
                );
              })}
            </div>
            {detail.history.items.length === 0 ? (
              <p className="text-sm text-[#4a5a70]">
                {detail.workOrderCount === 0 ? "Nenhuma ordem de serviço neste ativo." : "Nenhuma ordem neste filtro."}
              </p>
            ) : (
              <>
                <div className="hidden gap-x-5 pb-2 sm:flex">
                  <div className="w-[118px] flex-none text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">Data</div>
                  <div className="min-w-[220px] flex-1 text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">Ordem de serviço</div>
                  <div className="w-[130px] flex-none text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">Status</div>
                  <div className="w-[100px] flex-none text-right text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">Custo total</div>
                </div>
                {detail.history.items.map((item) => {
                  const when = splitWhen(item.at);
                  const style = ORDER_STATUS_STYLE[item.status] ?? ORDER_STATUS_STYLE.OPEN;
                  return (
                    <div key={item.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e9edf3] py-4 last:pb-0">
                      <div className="w-[118px] flex-none">
                        <div className="text-sm font-medium">{when.day}</div>
                        {when.time ? <div className="text-[13px] text-[#4a5a70]">{when.time}</div> : null}
                      </div>
                      <div className="min-w-[220px] flex-1">
                        <Link href={`/work-orders/${item.id}`} className="text-[15px] font-semibold text-[#14233a] no-underline hover:underline">
                          {item.title}
                        </Link>
                        <div className="text-[13px] text-[#4a5a70]">
                          {item.customId ? <span className="font-mono">{item.customId}</span> : null}
                          {item.customId ? " · " : ""}
                          {workOrderTypeLabel(item.type)}
                        </div>
                        <div className="text-[13px] text-[#4a5a70]">
                          Peças {formatBrl(item.partsCost)} · Mão de obra {formatBrl(item.laborCost)}
                        </div>
                      </div>
                      <div className="w-[130px] flex-none">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
                          <span className={`size-2 rounded-full ${style.dot}`} />
                          {workOrderStatusLabel(item.status)}
                        </span>
                      </div>
                      <div className="w-[100px] flex-none text-right font-semibold">{formatBrl(item.partsCost + item.laborCost)}</div>
                    </div>
                  );
                })}
              </>
            )}
            {detail.history.total > ASSET_HISTORY_PAGE_SIZE ? (
              <div className="-mx-4 mt-2">
                <TablePagination
                  page={history.page}
                  pageSize={ASSET_HISTORY_PAGE_SIZE}
                  total={detail.history.total}
                  pending={pending}
                  buttonClassName="border-[#cbd5e1] bg-white text-[#14233a] hover:bg-white"
                  onPageChange={(page) => visit({ page })}
                />
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-5">
          <section className={card} aria-label="Informações">
            <h2 className="text-lg font-semibold tracking-tight">Informações</h2>
            <Info icon={<Zap className="size-[18px]" />} label="Categoria" value={asset.categoryName} />
            <Info icon={<Building2 className="size-[18px]" />} label="Localização" value={asset.locationName} />
            <Info icon={<MapPin className="size-[18px]" />} label="Local de instalação" value={asset.area} last />
          </section>

          <section className={card} aria-label="Aquisição e garantia">
            <h2 className="text-lg font-semibold tracking-tight">Aquisição e garantia</h2>
            <Info
              icon={<CircleDollarSign className="size-[18px]" />}
              label="Custo de aquisição"
              value={asset.acquisitionCost == null ? null : formatBrl(asset.acquisitionCost)}
            />
            <Info icon={<CalendarCheck className="size-[18px]" />} label="Em serviço desde" value={formatDay(asset.inServiceDate)} />
            <Info icon={<Shield className="size-[18px]" />} label="Fim da garantia" value={formatDay(asset.warrantyExpirationDate)} last={!canEdit} />
            {canEdit ? (
              <button
                type="button"
                className="mt-1.5 inline-flex min-h-11 w-full items-center gap-2 border-t border-[#e9edf3] pt-1.5 font-semibold text-[#2a78d6]"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
                Completar cadastro do ativo
              </button>
            ) : null}
          </section>

          <section className={card} aria-label="Ordens por status">
            <h2 className="text-lg font-semibold tracking-tight">Ordens por status</h2>
            <p className="text-[13px] text-[#4a5a70]">
              {detail.workOrderCount === 1 ? "1 ordem no histórico" : `${detail.workOrderCount} ordens no histórico`}
            </p>
            {statusSegments.length === 0 ? (
              <p className="mt-4 text-sm text-[#4a5a70]">Nenhuma ordem para distribuir.</p>
            ) : (
              <>
                <div
                  role="img"
                  aria-label={`Barra empilhada: ${statusSegments.map((item) => `${item.count} ${item.label.toLowerCase()}`).join(", ")}`}
                  className="mt-[18px] mb-3.5 flex h-3.5 gap-0.5"
                >
                  {statusSegments.map((item) => (
                    <div key={item.value} className="rounded-[3px]" style={{ flex: `${item.count} 1 0`, background: item.bar }} />
                  ))}
                </div>
                {statusSegments.map((item, index) => (
                  <div key={item.value} className={`flex items-center gap-2.5 border-t border-[#e9edf3] py-2 ${index === statusSegments.length - 1 ? "pb-0" : ""}`}>
                    <span className="size-3 flex-none rounded-[3px]" style={{ background: item.bar }} />
                    <span className="flex-1 text-sm">{item.label}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                    <span className="w-[50px] text-right text-[13px] text-[#4a5a70]">{share(item.count, detail.workOrderCount)}</span>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      </div>

      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title={`Editar ${asset.customId ?? "ativo"}`}
        description="A localização é obrigatória."
      >
        {editing ? (
          <AssetForm
            key={asset.id}
            asset={{
              id: asset.id,
              name: asset.name,
              description: asset.description,
              location_id: asset.locationId,
              category_id: asset.categoryId,
              status: asset.status,
              model: asset.model,
              manufacturer: asset.manufacturer,
              serial_number: asset.serialNumber,
              bar_code: asset.barCode,
              power: asset.power,
              area: asset.area,
              acquisition_cost: asset.acquisitionCost,
              in_service_date: asset.inServiceDate,
              warranty_expiration_date: asset.warrantyExpirationDate,
              additional_infos: asset.additionalInfos,
              imageUrl: asset.imageUrl,
            }}
            locations={locations}
            categories={categories}
            canManageCategories={canManageCategories}
            tenantId={tenantId}
            onCancel={() => setEditing(false)}
            onSuccess={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        ) : null}
      </FormDialog>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[18px]">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-[13px] text-[#4a5a70]">{subtitle}</p>
    </div>
  );
}

function Stat({ label, value, note, muted = false }: { label: string; value: string; note: string; muted?: boolean }) {
  return (
    <div className="min-w-[200px] flex-1 rounded-xl bg-[#f5f7fb] px-[18px] py-4">
      <div className="text-[13px] font-medium text-[#5b6b80]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${muted ? "text-[#5b6b80]" : ""}`}>{value}</div>
      <div className="text-[13px] text-[#4a5a70]">{note}</div>
    </div>
  );
}

function Info({ icon, label, value, last = false }: { icon: ReactNode; label: string; value: string | null; last?: boolean }) {
  return (
    <div className={`mt-3 flex items-start gap-3.5 border-t border-[#e9edf3] py-3.5 ${last ? "pb-0" : ""}`}>
      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#eef3fb] text-[#0b1b33]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-wide text-[#5b6b80] uppercase">{label}</div>
        {value ? (
          <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
        ) : (
          <div className="mt-0.5 text-[15px] text-[#5b6b80]">Não informado</div>
        )}
      </div>
    </div>
  );
}

function assetChipClass(status: string) {
  if (status === "OPERATIONAL") return "bg-[rgba(12,163,12,0.11)] text-[#006300]";
  if (status === "DOWN" || status === "EMERGENCY_SHUTDOWN") return "bg-[rgba(208,59,59,0.11)] text-[#b42323]";
  if (status === "STANDBY") return "bg-[rgba(250,178,25,0.22)] text-[#8a5600]";
  return "bg-[#eef3fb] text-[#0b1b33]";
}

function availabilityColor(value: number | null) {
  if (value == null) return "#cbd5e1";
  if (value >= 0.9) return "#008300";
  if (value >= 0.7) return "#eda100";
  return "#d03b3b";
}

function formatAvailability(value: number | null) {
  if (value == null) return null;
  const percent = Math.round(value * 1000) / 10;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toLocaleString("pt-BR")}%`;
}

function formatTimes(maintenance: number, acquisition: number | null) {
  if (acquisition == null || acquisition <= 0) return null;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(maintenance / acquisition)}×`;
}

function typeSummary(detail: AssetDetail) {
  const parts = [
    detail.correctiveCount > 0 ? `${detail.correctiveCount} ${detail.correctiveCount === 1 ? "corretiva" : "corretivas"}` : null,
    detail.preventiveCount > 0 ? `${detail.preventiveCount} ${detail.preventiveCount === 1 ? "preventiva" : "preventivas"}` : null,
    detail.predictiveCount > 0 ? `${detail.predictiveCount} ${detail.predictiveCount === 1 ? "preditiva" : "preditivas"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "nenhuma ordem";
}

function share(count: number, total: number) {
  if (total <= 0) return "0%";
  const percent = Math.round((count / total) * 1000) / 10;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toLocaleString("pt-BR")}%`;
}

function formatDay(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function splitWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "—", time: "" };
  return {
    day: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(date),
  };
}
