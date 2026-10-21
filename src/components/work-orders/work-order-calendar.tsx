"use client";

import { useMemo, useRef, useState } from "react";
import FullCalendar, { type CalendarRef, type EventInput } from "@fullcalendar/react";
import ptBrLocale from "@fullcalendar/react/locales/pt-br";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import { Button } from "@/components/ui/button";
import { WORK_ORDER_STATUSES } from "@/lib/work-orders/status";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#64748b",
  IN_PROGRESS: "#059669",
  ON_HOLD: "#d97706",
  COMPLETE: "#0284c7",
};

function eventBounds(event: EventInput) {
  if (event.start == null) return null;
  const start = new Date(event.start as string | Date);
  if (Number.isNaN(start.getTime())) return null;
  const end = event.end != null ? new Date(event.end as string | Date) : start;
  if (Number.isNaN(end.getTime())) return { start, end: start };
  return { start, end: end.getTime() > start.getTime() ? end : start };
}

function overlapsRange(event: EventInput, rangeStart: Date, rangeEnd: Date) {
  const bounds = eventBounds(event);
  if (!bounds) return false;
  return bounds.start < rangeEnd && bounds.end >= rangeStart;
}

function nearestEventDate(events: EventInput[], from: Date) {
  const starts = events
    .map((event) => eventBounds(event)?.start)
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => left.getTime() - right.getTime());
  if (starts.length === 0) return null;
  return starts.find((date) => date >= from) ?? starts[starts.length - 1];
}

function initialCalendarDate(events: EventInput[]) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  if (events.some((event) => overlapsRange(event, weekStart, weekEnd))) return undefined;
  return nearestEventDate(events, weekStart) ?? undefined;
}

function localDay(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toEvents(orders: WorkOrderRecord[]): EventInput[] {
  const events: EventInput[] = [];

  for (const order of orders) {
    const timed = Boolean(order.estimatedStartDate);
    const source = order.estimatedStartDate ?? order.dueDate;
    if (!source) continue;

    const hours = order.estimatedDuration ?? 0;
    events.push({
      id: order.id,
      title: order.customId ? `${order.customId} · ${order.title}` : order.title,
      start: timed ? source : localDay(source),
      end:
        timed && hours > 0
          ? new Date(new Date(source).getTime() + hours * 60 * 60 * 1000).toISOString()
          : undefined,
      allDay: !timed,
      color: STATUS_COLOR[order.status] ?? "#64748b",
    });
  }

  return events;
}

export function WorkOrderCalendar({
  orders,
  onOpen,
  onCreate,
}: {
  orders: WorkOrderRecord[];
  onOpen: (id: string) => void;
  onCreate: (date: Date, allDay: boolean) => void;
}) {
  const calendarRef = useRef<CalendarRef>(null);
  const events = useMemo(() => toEvents(orders), [orders]);
  const initialDate = useMemo(() => initialCalendarDate(events), [events]);
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);
  const hidden = orders.length - events.length;
  const outsideDate = useMemo(() => {
    if (!visibleRange) return null;
    if (events.some((event) => overlapsRange(event, visibleRange.start, visibleRange.end))) {
      return null;
    }
    return nearestEventDate(events, visibleRange.start);
  }, [events, visibleRange]);

  return (
    <div className="wo-calendar px-3 py-3">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        {WORK_ORDER_STATUSES.map((item) => (
          <span key={item.value} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[item.value] ?? "#64748b" }}
            />
            {item.label}
          </span>
        ))}
      </div>
      {outsideDate ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
          <span>Nenhuma ordem neste período.</span>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => calendarRef.current?.getApi().gotoDate(outsideDate)}
          >
            Ir para{" "}
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(outsideDate)}
          </Button>
        </div>
      ) : null}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, classicThemePlugin]}
        initialView="dayGridMonth"
        initialDate={initialDate}
        locale={ptBrLocale}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
        }}
        height={680}
        dayMaxEventRows={3}
        eventMinHeight={24}
        nowIndicator
        events={events}
        datesSet={(info) => {
          setVisibleRange((current) => {
            if (
              current &&
              current.start.getTime() === info.start.getTime() &&
              current.end.getTime() === info.end.getTime()
            ) {
              return current;
            }
            return { start: info.start, end: info.end };
          });
        }}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          onOpen(info.event.id);
        }}
        dateClick={(info) => onCreate(info.date, info.allDay)}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        noEventsText="Nenhuma ordem neste período"
      />
      {hidden > 0 ? (
        <p className="px-1 pt-3 text-xs text-muted-foreground">
          {hidden === 1
            ? "1 ordem sem vencimento nem início estimado fica só na lista."
            : `${hidden} ordens sem vencimento nem início estimado ficam só na lista.`}
        </p>
      ) : null}
    </div>
  );
}
