"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { civilDay, monthTitle } from "@/lib/dashboard/overview";
import type { WorkOrderCalendarItem } from "@/lib/work-orders/queries";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const TYPE_PILL: Record<string, { short: string; className: string; label: string }> = {
  PREVENTIVE: { short: "P", className: "bg-[rgba(42,120,214,0.16)]", label: "Preventiva" },
  CORRECTIVE: { short: "C", className: "bg-[rgba(235,104,52,0.18)]", label: "Corretiva" },
  PREDICTIVE: { short: "Pr", className: "bg-[rgba(98,80,214,0.16)]", label: "Preditiva" },
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function currentMonth() {
  const today = civilDay(new Date().toISOString());
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function startDow(year: number, month: number) {
  const probe = new Date(`${year}-${pad(month)}-01T12:00:00-03:00`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(probe);
  return WEEKDAY_INDEX[name] ?? 0;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function scheduleDay(order: WorkOrderCalendarItem) {
  const source = order.estimatedStartDate ?? order.dueDate;
  return source ? civilDay(source) : null;
}

export function WorkOrderCalendar({
  orders,
  canEdit,
  onOpen,
  onCreate,
}: {
  orders: WorkOrderCalendarItem[];
  canEdit: boolean;
  onOpen: (id: string) => void;
  onCreate: (date: Date, allDay: boolean) => void;
}) {
  const today = civilDay(new Date().toISOString());
  const [cursor, setCursor] = useState(currentMonth);
  const prefix = `${cursor.year}-${pad(cursor.month)}`;
  const totalDays = daysInMonth(cursor.year, cursor.month);
  const lead = startDow(cursor.year, cursor.month);
  const tail = (lead + totalDays) % 7 === 0 ? 0 : 7 - ((lead + totalDays) % 7);

  const { byDay, undated } = useMemo(() => {
    const grouped = new Map<number, WorkOrderCalendarItem[]>();
    let missing = 0;
    for (const order of orders) {
      const day = scheduleDay(order);
      if (!day) {
        missing += 1;
        continue;
      }
      if (!day.startsWith(prefix)) continue;
      const number = Number(day.slice(8, 10));
      const list = grouped.get(number) ?? [];
      list.push(order);
      grouped.set(number, list);
    }
    return { byDay: grouped, undated: missing };
  }, [orders, prefix]);

  const monthCount = [...byDay.values()].reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="px-4 py-3 text-[#14233a]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold capitalize">{monthTitle(`${prefix}-01`)}</h2>
          <p className="text-[13px] text-[#4a5a70]">{monthCount} OS com data neste mês</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {Object.entries(TYPE_PILL).map(([type, pill]) => (
              <span key={type} className={cn("rounded-md px-2 py-0.5", pill.className)}>
                {pill.short} · {pill.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              className="inline-flex size-9 items-center justify-center rounded-[10px] border border-[#14233a]/12"
              onClick={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className="h-9 rounded-[10px] border border-[#14233a]/12 px-3 text-sm font-medium"
              onClick={() => setCursor(currentMonth())}
            >
              Hoje
            </button>
            <button
              type="button"
              aria-label="Próximo mês"
              className="inline-flex size-9 items-center justify-center rounded-[10px] border border-[#14233a]/12"
              onClick={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-[#64748b]">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, index) => (
          <div key={`blank-${index}`} className="min-h-[92px] rounded-[10px]" />
        ))}
        {Array.from({ length: totalDays }, (_, index) => {
          const day = index + 1;
          const iso = `${prefix}-${pad(day)}`;
          const isToday = iso === today;
          const past = iso < today;
          const items = byDay.get(day) ?? [];
          const visible = items.slice(0, 4);
          return (
            <div
              key={iso}
              onClick={() => {
                if (canEdit) onCreate(new Date(cursor.year, cursor.month - 1, day, 9, 0, 0), true);
              }}
              className={cn(
                "flex min-h-[92px] flex-col gap-1.5 rounded-[10px] border bg-white p-1.5",
                isToday ? "border-2 border-[#2a78d6]" : "border-[#14233a]/12",
                past && "opacity-60",
                canEdit && "cursor-pointer",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={cn("inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[13px] font-semibold", isToday && "bg-[#14233a] text-white")}>
                  {day}
                </span>
                {isToday ? <span className="text-[11px] text-[#64748b]">Hoje</span> : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {visible.map((order) => {
                  const pill = TYPE_PILL[order.type] ?? TYPE_PILL.CORRECTIVE;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      title={order.customId ? `${order.customId} · ${order.title}` : order.title}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(order.id);
                      }}
                      className={cn("max-w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold", pill.className)}
                    >
                      {pill.short}
                      {order.customId ? ` ${order.customId}` : ""}
                    </button>
                  );
                })}
                {items.length > visible.length ? (
                  <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#4a5a70]">+{items.length - visible.length}</span>
                ) : null}
              </div>
            </div>
          );
        })}
        {Array.from({ length: tail }, (_, index) => (
          <div key={`tail-${index}`} className="min-h-[92px] rounded-[10px]" />
        ))}
      </div>
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
