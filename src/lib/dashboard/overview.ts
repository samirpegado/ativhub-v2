import { ASSET_STATUSES, assetStatusColor } from "@/lib/assets/status";
import { WORK_ORDER_STATUSES, WORK_ORDER_TYPES, workOrderStatusColor } from "@/lib/work-orders/status";

export type RunningOrder = {
  id: string;
  customId: string | null;
  title: string;
  type: string;
  assetName: string;
  worker: string;
  initials: string;
  startedAt: string | null;
  live: boolean;
  status: string;
  elapsedSeconds: number;
  estimatedSeconds: number;
  tasksDone: number;
  tasksTotal: number;
};

export type UpcomingOrder = {
  id: string;
  customId: string | null;
  title: string;
  type: string;
  assetName: string;
  dueDate: string | null;
  estimatedSeconds: number;
  running: boolean;
  over: boolean;
};

export type OverviewWeek = {
  start: string;
  label: string;
  current: boolean;
  closed: number;
  onTime: number;
  late: number;
};

export type OverviewDay = {
  day: number;
  preventive: number;
  corrective: number;
  predictive: number;
  items: { type: string; state: "done" | "running" | "pending" }[];
};

export type MaintenanceOverview = {
  today: string;
  monthStart: string;
  monthStartDow: number;
  openCount: number;
  overdueCount: number;
  onHoldCount: number;
  staleCount: number;
  readyCount: number;
  toStartCount: number;
  closed30: number;
  closedPrev30: number;
  closed5w: number;
  onTime30: number;
  due30: number;
  onTime5w: number;
  late5w: number;
  mttrSeconds: number | null;
  mttrPrevSeconds: number | null;
  status30: { status: string; label: string; count: number; color: string }[];
  assets: { status: string; label: string; count: number; color: string }[];
  assetTotal: number;
  operationalCount: number;
  downCount: number;
  emergencyCount: number;
  running: RunningOrder[];
  board: RunningOrder[];
  overNames: string;
  upcoming: UpcomingOrder[];
  byType: { type: string; label: string; count: number; color: string }[];
  weeks: OverviewWeek[];
  correctiveRank: { name: string; count: number }[];
  days: OverviewDay[];
};

const TYPE_COLOR: Record<string, string> = {
  PREVENTIVE: "#2a78d6",
  CORRECTIVE: "#eb6834",
  PREDICTIVE: "#6250d6",
};

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function num(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readRunning(value: unknown): RunningOrder[] {
  return list(value).flatMap((item) => {
    const row = record(item);
    const id = text(row?.id);
    const title = text(row?.title);
    const startedAt = text(row?.startedAt);
    if (!row || !id || !title) return [];
    return [
      {
        id,
        customId: text(row.customId),
        title,
        type: text(row.type) ?? "CORRECTIVE",
        assetName: text(row.assetName) ?? title,
        worker: text(row.worker) ?? "Usuário",
        initials: text(row.initials) ?? "?",
        startedAt,
        live: row.live === true || (row.live == null && Boolean(startedAt)),
        status: text(row.status) ?? "IN_PROGRESS",
        elapsedSeconds: num(row.elapsedSeconds),
        estimatedSeconds: num(row.estimatedSeconds),
        tasksDone: num(row.tasksDone),
        tasksTotal: num(row.tasksTotal),
      },
    ];
  });
}

function readUpcoming(value: unknown): UpcomingOrder[] {
  return list(value).flatMap((item) => {
    const row = record(item);
    const id = text(row?.id);
    const title = text(row?.title);
    if (!row || !id || !title) return [];
    return [
      {
        id,
        customId: text(row.customId),
        title,
        type: text(row.type) ?? "CORRECTIVE",
        assetName: text(row.assetName) ?? title,
        dueDate: text(row.dueDate),
        estimatedSeconds: num(row.estimatedSeconds),
        running: row.running === true,
        over: row.over === true,
      },
    ];
  });
}

export function readMaintenanceOverview(data: unknown): MaintenanceOverview {
  const row = record(data) ?? {};
  const statusBag = record(row.status30) ?? {};
  const assetBag = record(row.assets) ?? {};
  const typeBag = record(row.byType) ?? {};
  const assets = ASSET_STATUSES.map((item) => ({
    status: item.value,
    label: item.label,
    count: num(assetBag[item.value]),
    color: assetStatusColor(item.value),
  }));

  return {
    today: text(row.today) ?? new Date().toISOString().slice(0, 10),
    monthStart: text(row.monthStart) ?? new Date().toISOString().slice(0, 10),
    monthStartDow: num(row.monthStartDow),
    openCount: num(row.openCount),
    overdueCount: num(row.overdueCount),
    onHoldCount: num(row.onHoldCount),
    staleCount: num(row.staleCount),
    readyCount: num(row.readyCount),
    toStartCount: num(row.toStartCount),
    closed30: num(row.closed30),
    closedPrev30: num(row.closedPrev30),
    closed5w: num(row.closed5w),
    onTime30: num(row.onTime30),
    due30: num(row.due30),
    onTime5w: num(row.onTime5w),
    late5w: num(row.late5w),
    mttrSeconds: row.mttrSeconds == null ? null : num(row.mttrSeconds),
    mttrPrevSeconds: row.mttrPrevSeconds == null ? null : num(row.mttrPrevSeconds),
    status30: WORK_ORDER_STATUSES.map((item) => ({
      status: item.value,
      label: item.label,
      count: num(statusBag[item.value]),
      color: workOrderStatusColor(item.value),
    })),
    assets,
    assetTotal: assets.reduce((sum, item) => sum + item.count, 0),
    operationalCount: num(assetBag.OPERATIONAL),
    downCount: num(row.downCount),
    emergencyCount: num(row.emergencyCount),
    running: readRunning(row.running),
    board: readRunning(row.board),
    overNames: text(row.overNames) ?? "",
    upcoming: readUpcoming(row.upcoming),
    byType: WORK_ORDER_TYPES.map((item) => ({
      type: item.value,
      label: item.label,
      count: num(typeBag[item.value]),
      color: TYPE_COLOR[item.value] ?? "#64748b",
    })),
    weeks: list(row.weeks).flatMap((item) => {
      const week = record(item);
      const start = text(week?.start);
      if (!week || !start) return [];
      return [
        {
          start,
          label: text(week.label) ?? start,
          current: week.current === true,
          closed: num(week.closed),
          onTime: num(week.onTime),
          late: num(week.late),
        },
      ];
    }),
    correctiveRank: list(row.correctiveRank).flatMap((item) => {
      const rank = record(item);
      const name = text(rank?.name);
      if (!rank || !name) return [];
      return [{ name, count: num(rank.count) }];
    }),
    days: list(row.days).flatMap((item) => {
      const day = record(item);
      if (!day || !num(day.day)) return [];
      return [
        {
          day: num(day.day),
          preventive: num(day.preventive),
          corrective: num(day.corrective),
          predictive: num(day.predictive),
          items: list(day.items).flatMap((entry) => {
            const pill = record(entry);
            const type = text(pill?.type);
            const state = text(pill?.state);
            if (!type || (state !== "done" && state !== "running" && state !== "pending")) return [];
            return [{ type, state }];
          }),
        },
      ];
    }),
  };
}

export function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours}h ${String(minutes).padStart(2, "0")}min` : `${hours}h`;
}

export function pace(elapsedSeconds: number, estimatedSeconds: number) {
  if (estimatedSeconds <= 0) return "none" as const;
  const ratio = elapsedSeconds / estimatedSeconds;
  if (ratio > 1) return "over" as const;
  if (ratio >= 0.85) return "warn" as const;
  return "ok" as const;
}

export function share(part: number, total: number, digits = 0) {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(digits).replace(".", ",")}%`;
}

export function signedPercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const TECH_RANGES = [
  {
    id: "week",
    label: "Esta semana",
    queue: "Nesta semana",
    empty: "Nada programado nesta semana.",
    closed: "Nesta semana",
    start: "Programadas nesta semana",
  },
  {
    id: "15",
    label: "Últimos 15 dias",
    queue: "Nos últimos 15 dias",
    empty: "Nada programado nos últimos 15 dias.",
    closed: "Nos últimos 15 dias",
    start: "Programadas nos últimos 15 dias",
  },
  {
    id: "30",
    label: "Últimos 30 dias",
    queue: "Nos últimos 30 dias",
    empty: "Nada programado nos últimos 30 dias.",
    closed: "Nos últimos 30 dias",
    start: "Programadas nos últimos 30 dias",
  },
] as const;

export type TechRange = (typeof TECH_RANGES)[number]["id"];

export function parseTechRange(value: string | undefined): TechRange {
  if (value === "week" || value === "15") return value;
  return "30";
}

export function techRange(value: TechRange) {
  return TECH_RANGES.find((item) => item.id === value) ?? TECH_RANGES[0];
}

export function longDate(isoDay: string) {
  const date = new Date(`${isoDay}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function monthTitle(isoDay: string) {
  const date = new Date(`${isoDay}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDay;
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  return `${month} de ${date.getFullYear()}`;
}

export function civilDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function civilTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
