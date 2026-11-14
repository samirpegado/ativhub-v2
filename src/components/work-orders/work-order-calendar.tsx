"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { civilDay, monthTitle } from "@/lib/dashboard/overview";
import type { WorkOrderCalendarItem } from "@/lib/work-orders/queries";
import { workOrderStatusDot, workOrderStatusLabel } from "@/lib/work-orders/status";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const VIEWS = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
] as const;
const START_HOUR = 7;
const END_HOUR = 19;
const HOUR_PX = 56;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);

const TYPE_PILL: Record<string, { short: string; className: string; label: string }> = {
  PREVENTIVE: { short: "P", className: "bg-[rgba(42,120,214,0.16)] text-[#0b1b33]", label: "Preventiva" },
  CORRECTIVE: { short: "C", className: "bg-[rgba(235,104,52,0.18)] text-[#0b1b33]", label: "Corretiva" },
  PREDICTIVE: { short: "Pr", className: "bg-[rgba(98,80,214,0.16)] text-[#0b1b33]", label: "Preditiva" },
};

type View = (typeof VIEWS)[number]["id"];

type Placed = {
  order: WorkOrderCalendarItem;
  day: string;
  minutes: number | null;
  durationMinutes: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function weekday(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function weekStart(iso: string) {
  return addDays(iso, -weekday(iso));
}

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function daysInMonth(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function civilParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(read("hour"));
  const minute = Number(read("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return {
    day: `${read("year")}-${read("month")}-${read("day")}`,
    minutes: hour * 60 + minute,
  };
}

function place(order: WorkOrderCalendarItem): Placed | null {
  if (order.estimatedStartDate) {
    const parts = civilParts(order.estimatedStartDate);
    if (!parts) return null;
    const hours = order.estimatedDuration && order.estimatedDuration > 0 ? order.estimatedDuration : 1;
    return { order, day: parts.day, minutes: parts.minutes, durationMinutes: Math.round(hours * 60) };
  }
  if (!order.dueDate) return null;
  const day = civilDay(order.dueDate);
  return day ? { order, day, minutes: null, durationMinutes: 60 } : null;
}

function dayTitle(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function weekTitle(start: string) {
  const end = addDays(start, 6);
  const startLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${start}T12:00:00Z`));
  const endLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${end}T12:00:00Z`));
  return `${startLabel} – ${endLabel}`;
}

function clock(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function pillOf(type: string) {
  return TYPE_PILL[type] ?? TYPE_PILL.CORRECTIVE;
}

export function WorkOrderCalendar({
  orders,
  onOpen,
}: {
  orders: WorkOrderCalendarItem[];
  onOpen: (id: string) => void;
}) {
  const today = civilDay(new Date().toISOString());
  const [view, setView] = useState<View>("month");
  const [focus, setFocus] = useState(today);
  const [selected, setSelected] = useState(today);
  const now = civilParts(new Date().toISOString());

  const placed = useMemo(() => orders.flatMap((order) => {
    const item = place(order);
    return item ? [item] : [];
  }), [orders]);
  const undated = orders.length - placed.length;

  const range = view === "day" ? [focus] : view === "week" ? Array.from({ length: 7 }, (_, index) => addDays(weekStart(focus), index)) : [];
  const visible = view === "month"
    ? placed.filter((item) => item.day.startsWith(focus.slice(0, 7)))
    : placed.filter((item) => range.includes(item.day));

  function shift(delta: number) {
    if (view === "month") {
      const [year, month] = focus.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1 + delta, 1));
      setFocus(date.toISOString().slice(0, 10));
      return;
    }
    setFocus((current) => addDays(current, view === "week" ? delta * 7 : delta));
  }

  const dayOrders = placed
    .filter((item) => item.day === selected)
    .sort((left, right) => (left.minutes ?? -1) - (right.minutes ?? -1));

  const title = view === "month" ? monthTitle(monthStart(focus)) : view === "week" ? weekTitle(weekStart(focus)) : dayTitle(focus);

  return (
    <div className="px-4 py-3 text-[#14233a]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold capitalize">{title}</h2>
          <p className="text-[13px] text-[#4a5a70]">{visible.length} OS neste período</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[10px] border border-[#14233a]/12 p-0.5" role="group" aria-label="Período do calendário">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                className={cn("h-8 rounded-lg px-3 text-sm font-medium", view === item.id ? "bg-[#14233a] text-white" : "text-[#4a5a70]")}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="h-9 rounded-[10px] border border-[#14233a]/12 px-3 text-sm font-medium" onClick={() => setFocus(today)}>
            Hoje
          </button>
          <button type="button" aria-label="Período anterior" className="inline-flex size-9 items-center justify-center rounded-[10px] border border-[#14233a]/12" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Próximo período" className="inline-flex size-9 items-center justify-center rounded-[10px] border border-[#14233a]/12" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
        {Object.entries(TYPE_PILL).map(([type, pill]) => (
          <span key={type} className={cn("rounded-md px-2 py-0.5", pill.className)}>{pill.short} · {pill.label}</span>
        ))}
      </div>

      {view === "month" ? (
        <MonthGrid focus={focus} today={today} selected={selected} items={visible} onOpen={onOpen} onSelect={setSelected} />
      ) : (
        <TimeGrid days={range} today={today} selected={selected} items={visible} now={now} onOpen={onOpen} onSelect={setSelected} />
      )}

      <section className="mt-4 rounded-[14px] border border-[#14233a]/12 bg-white p-4" aria-label="Ordens do dia selecionado">
        <h3 className="text-sm font-semibold capitalize">{dayTitle(selected)}</h3>
        {dayOrders.length === 0 ? (
          <p className="mt-2 text-sm text-[#4a5a70]">Nenhuma ordem neste dia.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#e9edf3]">
            {dayOrders.map((item) => {
              const pill = pillOf(item.order.type);
              return (
                <li key={item.order.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => onOpen(item.order.id)}>
                    <span className="min-w-0">
                      <span className="font-mono text-sm text-[#4a5a70]">{item.order.customId ?? "Ordem"}</span>
                      <span className="mt-0.5 block truncate font-semibold">{item.order.title}</span>
                      <span className={cn("mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold", pill.className)}>
                        {item.minutes == null ? "Dia todo" : clock(item.minutes)} · {pill.label}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-2 text-sm text-[#4a5a70]">
                      <span className={cn("size-2.5 rounded-full", workOrderStatusDot(item.order.status))} />
                      {workOrderStatusLabel(item.order.status)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {undated > 0 ? (
        <p className="px-1 pt-3 text-xs text-[#4a5a70]">
          {undated === 1
            ? "1 ordem sem vencimento nem início estimado fica só na lista."
            : `${undated} ordens sem vencimento nem início estimado ficam só na lista.`}
        </p>
      ) : null}
    </div>
  );
}

function MonthGrid({
  focus,
  today,
  selected,
  items,
  onOpen,
  onSelect,
}: {
  focus: string;
  today: string;
  selected: string;
  items: Placed[];
  onOpen: (id: string) => void;
  onSelect: (iso: string) => void;
}) {
  const start = monthStart(focus);
  const total = daysInMonth(focus);
  const lead = weekday(start);
  const byDay = new Map<string, Placed[]>();
  for (const item of items) {
    const list = byDay.get(item.day) ?? [];
    list.push(item);
    byDay.set(item.day, list);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day) => <div key={day} className="text-center text-xs font-semibold text-[#64748b]">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }, (_, index) => <div key={`lead-${index}`} className="min-h-[92px]" />)}
          {Array.from({ length: total }, (_, index) => {
            const iso = addDays(start, index);
            const dayItems = byDay.get(iso) ?? [];
            const isToday = iso === today;
            return (
              <div
                key={iso}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(iso)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(iso);
                  }
                }}
                className={cn(
                  "flex min-h-[92px] cursor-pointer flex-col gap-1.5 rounded-[10px] border bg-white p-1.5 text-left",
                  iso === selected ? "border-2 border-[#14233a]" : isToday ? "border-2 border-[#2a78d6]" : "border-[#14233a]/12",
                  iso < today && iso !== selected && "opacity-60",
                )}
              >
                <span className={cn("inline-flex h-[26px] min-w-[26px] items-center justify-center self-start rounded-full px-1 text-[13px] font-semibold", isToday && "bg-[#14233a] text-white")}>
                  {Number(iso.slice(8, 10))}
                </span>
                <div className="flex flex-wrap gap-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <EventButton key={item.order.id} item={item} onOpen={onOpen} compact />
                  ))}
                  {dayItems.length > 3 ? <span className="px-1 text-[11px] font-semibold text-[#4a5a70]">+{dayItems.length - 3}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  today,
  selected,
  items,
  now,
  onOpen,
  onSelect,
}: {
  days: string[];
  today: string;
  selected: string;
  items: Placed[];
  now: { day: string; minutes: number } | null;
  onOpen: (id: string) => void;
  onSelect: (iso: string) => void;
}) {
  const columns = days.length;
  return (
    <div className="overflow-x-auto rounded-[14px] border border-[#14233a]/12 bg-white">
      <div className="min-w-[760px]">
        <div className="grid border-b border-[#e9edf3]" style={{ gridTemplateColumns: `4rem repeat(${columns}, minmax(0, 1fr))` }}>
          <div />
          {days.map((iso) => (
            <button key={iso} type="button" className={cn("px-2 py-2 text-center text-sm", iso === selected && "bg-[#f5f7fb] font-semibold", iso === today && "text-[#2a78d6]")} onClick={() => onSelect(iso)}>
              <div className="text-xs text-[#64748b]">{WEEKDAYS[weekday(iso)]}</div>
              <div>{Number(iso.slice(8, 10))}</div>
            </button>
          ))}
        </div>
        <div className="grid border-b border-[#e9edf3]" style={{ gridTemplateColumns: `4rem repeat(${columns}, minmax(0, 1fr))` }}>
          <div className="px-2 py-2 text-[11px] text-[#64748b]">Dia todo</div>
          {days.map((iso) => (
            <div key={iso} className="space-y-1 border-l border-[#e9edf3] p-1">
              {items.filter((item) => item.day === iso && item.minutes == null).map((item) => (
                <EventButton key={item.order.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          ))}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `4rem repeat(${columns}, minmax(0, 1fr))` }}>
          <div>
            {HOURS.map((hour) => (
              <div key={hour} className="border-t border-[#e9edf3] pr-2 text-right text-[11px] text-[#64748b]" style={{ height: HOUR_PX }}>
                <span className="-mt-2 block">{pad(hour)}:00</span>
              </div>
            ))}
          </div>
          {days.map((iso) => (
            <div key={iso} className="relative border-l border-[#e9edf3]">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  aria-label={`Ver ordens de ${iso}`}
                  className="block w-full border-t border-[#e9edf3] hover:bg-[#f5f7fb]"
                  style={{ height: HOUR_PX }}
                  onClick={() => onSelect(iso)}
                />
              ))}
              {items.filter((item) => item.day === iso && item.minutes != null).map((item) => {
                const start = Math.max(START_HOUR * 60, item.minutes ?? 0);
                const end = Math.min(END_HOUR * 60, (item.minutes ?? 0) + item.durationMinutes);
                if (end <= START_HOUR * 60 || start >= END_HOUR * 60) return null;
                const top = ((start - START_HOUR * 60) / 60) * HOUR_PX;
                const height = Math.max(28, ((end - start) / 60) * HOUR_PX);
                return (
                  <div key={item.order.id} className="absolute right-1 left-1 z-10" style={{ top, height }}>
                    <EventButton item={item} onOpen={onOpen} timed />
                  </div>
                );
              })}
              {now && now.day === iso && now.minutes >= START_HOUR * 60 && now.minutes <= END_HOUR * 60 ? (
                <div className="pointer-events-none absolute right-0 left-0 z-20 h-px bg-[#d03b3b]" style={{ top: ((now.minutes - START_HOUR * 60) / 60) * HOUR_PX }} />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventButton({
  item,
  onOpen,
  compact = false,
  timed = false,
}: {
  item: Placed;
  onOpen: (id: string) => void;
  compact?: boolean;
  timed?: boolean;
}) {
  const pill = pillOf(item.order.type);
  const label = item.order.customId ? `${item.order.customId} · ${item.order.title}` : item.order.title;
  return (
    <button
      type="button"
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item.order.id);
      }}
      className={cn("block max-w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold", pill.className, timed && "h-full w-full")}
    >
      {compact ? `${pill.short}${item.order.customId ? ` ${item.order.customId}` : ""}` : (
        <>
          {item.minutes != null ? <span className="mr-1 font-medium">{clock(item.minutes)}</span> : null}
          {label}
        </>
      )}
    </button>
  );
}
