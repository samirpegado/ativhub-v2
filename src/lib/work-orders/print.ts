import { assetStatusLabel } from "@/lib/assets/status";
import { formatQuantity } from "@/lib/inventory/format";
import { formatBrl } from "@/lib/money/brl";
import { formatDuration } from "@/lib/work-orders/activity";
import { partsTotal, serviceCharge, isBillingMode, type BillingMode } from "@/lib/work-orders/billing";
import {
  workOrderPriorityLabel,
  workOrderStatusLabel,
  workOrderTypeLabel,
} from "@/lib/work-orders/status";
import { formatTaxId, taxDigits } from "@/lib/tax-id/br";
import { formatCep } from "@/lib/address/format";
import { taskAnswerLabel, taskTypeLabel, type TaskType, type WorkOrderTask } from "@/lib/work-orders/tasks";

export type PrintTone = "ok" | "warn" | "bad" | "info" | "gray";

export type WorkOrderPrint = {
  code: string;
  title: string;
  description: string | null;
  statusLabel: string;
  statusTone: PrintTone;
  priorityLabel: string;
  priorityTone: PrintTone;
  typeLabel: string;
  dueDay: string;
  dueTime: string | null;
  laborLabel: string;
  laborNote: string;
  tasksLabel: string;
  tasksNote: string;
  partsLabel: string;
  partsNote: string;
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    websiteLabel: string | null;
    websiteHref: string | null;
    logoUrl: string | null;
    initials: string;
  };
  customer: {
    name: string;
    type: string | null;
    tax: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
  } | null;
  location: { name: string; address: string | null } | null;
  asset: {
    name: string;
    code: string | null;
    statusLabel: string;
    statusTone: PrintTone;
    category: string;
    manufacturer: string;
    model: string;
    serial: string;
    barcode: string;
    power: string;
    area: string;
    inService: string;
    warranty: string;
    cost: string;
    description: string | null;
    extra: string | null;
  } | null;
  tasksHeading: string;
  tasks: {
    label: string;
    type: string;
    answer: string;
    tone: PrintTone | null;
    mark: string | null;
    comment: string;
    pending: boolean;
    day: string | null;
    time: string | null;
  }[];
  labors: { day: string; author: string; origin: string; time: string }[];
  laborTotal: string;
  parts: { name: string; quantity: string; value: string }[];
  partsTotal: string;
  serviceNote: string | null;
  serviceValue: string;
  totalValue: string;
  images: { name: string; url: string }[];
  generatedOn: string;
};

const PAGE_TASK_TYPE: Record<string, string> = {
  SUBTASK: "subtarefa",
  TEXT: "texto",
  NUMBER: "número",
  INSPECTION: "inspeção",
  MULTIPLE: "múltipla escolha",
};

export async function loadWorkOrderPrint(id: string): Promise<WorkOrderPrint | null> {
  const source = await fetchPublicPrint(id);
  if (!source) return null;

  const { order } = source;
  const answered = source.tasks.filter((task) => task.value).length;
  const laborSeconds = source.labors.reduce((sum, labor) => sum + labor.durationSeconds, 0);
  const charge = order.billingMode === "NONE" ? null : serviceCharge(
    { billingMode: order.billingMode, serviceAmount: order.serviceAmount },
    {
      timer: null,
      labors: source.labors.map((labor) => ({
        id: labor.author,
        durationSeconds: labor.durationSeconds,
        workedOn: labor.workedOn,
        startedAt: null,
        fromTimer: labor.fromTimer,
        hourlyRate: labor.hourlyRate,
        author: labor.author,
      })),
    },
  );
  const partsValue = partsTotal(source.parts);
  const sortedTasks = [...source.tasks].sort((left, right) => {
    const leftAt = left.executedAt ? Date.parse(left.executedAt) : Number.POSITIVE_INFINITY;
    const rightAt = right.executedAt ? Date.parse(right.executedAt) : Number.POSITIVE_INFINITY;
    return leftAt - rightAt;
  });
  const companyName = source.company.name.trim() || "AtivHub";

  return {
    code: order.customId ?? "Ordem de serviço",
    title: order.title,
    description: order.description,
    statusLabel: workOrderStatusLabel(order.status),
    statusTone: statusTone(order.status),
    priorityLabel: `Prioridade ${workOrderPriorityLabel(order.priority).toLowerCase()}`,
    priorityTone: priorityTone(order.priority),
    typeLabel: workOrderTypeLabel(order.type),
    dueDay: splitWhen(order.dueDate).day,
    dueTime: splitWhen(order.dueDate).time,
    laborLabel: formatDuration(laborSeconds),
    laborNote: source.labors.length === 1 ? "1 lançamento" : `${source.labors.length} lançamentos`,
    tasksLabel: `${answered} de ${source.tasks.length}`,
    tasksNote: answered === source.tasks.length && source.tasks.length > 0 ? "respondidas" : "em aberto",
    partsLabel: String(source.parts.length),
    partsNote: source.parts.length === 0 ? "nenhuma utilizada" : "utilizadas",
    company: {
      name: companyName,
      address: lineAddress(source.company.address) || null,
      phone: source.company.phone || null,
      websiteLabel: websiteLabel(source.company.website),
      websiteHref: websiteHref(source.company.website),
      logoUrl: source.company.logoUrl,
      initials: initials(companyName),
    },
    customer: source.customer
      ? {
          name: source.customer.name,
          type: source.customer.type,
          tax: taxLine(source.customer.taxId),
          phone: source.customer.phone,
          email: source.customer.email,
          description: source.customer.description,
        }
      : null,
    location: source.location
      ? {
          name: source.location.name,
          address: lineAddress(source.location) || source.location.address,
        }
      : null,
    asset: source.asset
      ? {
          name: source.asset.name,
          code: source.asset.code,
          statusLabel: assetStatusLabel(source.asset.status),
          statusTone: assetTone(source.asset.status),
          category: source.asset.category || "—",
          manufacturer: source.asset.manufacturer || "—",
          model: source.asset.model || "—",
          serial: source.asset.serial || "—",
          barcode: source.asset.barcode || "—",
          power: source.asset.power || "—",
          area: source.asset.area || "—",
          inService: formatDateOnly(source.asset.inService),
          warranty: formatDateOnly(source.asset.warranty),
          cost: source.asset.cost == null ? "—" : formatBrl(source.asset.cost),
          description: source.asset.description,
          extra: source.asset.extra,
        }
      : null,
    tasksHeading:
      source.tasks.length === 0
        ? "Tarefas"
        : `Tarefas · ${answered} de ${source.tasks.length} respondida${answered === 1 ? "" : "s"}`,
    tasks: sortedTasks.map(printTask),
    labors: source.labors.map((labor) => ({
      day: formatDateOnly(labor.workedOn),
      author: labor.author,
      origin: labor.fromTimer ? "Temporizador" : "Manual",
      time: formatDuration(labor.durationSeconds),
    })),
    laborTotal: formatDuration(laborSeconds),
    parts: source.parts.map((part) => ({
      name: part.name,
      quantity: formatQuantity(part.quantity, part.unit),
      value: formatBrl(part.cost * part.quantity),
    })),
    partsTotal: formatBrl(partsValue),
    serviceNote:
      order.billingMode === "HOURLY" && order.serviceAmount != null
        ? `(${formatBrl(order.serviceAmount)}/h × ${formatHourCount(laborSeconds)} h)`
        : order.billingMode === "FIXED"
          ? "(valor fixo)"
          : null,
    serviceValue: charge == null ? "Sem cobrança" : formatBrl(charge),
    totalValue: formatBrl((charge ?? 0) + partsValue),
    images: source.files.flatMap((file) =>
      /\.(png|jpe?g|webp|gif)$/i.test(file.name) && file.url ? [{ name: file.name, url: file.url }] : [],
    ),
    generatedOn: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  };
}

type PublicPrint = {
  order: {
    customId: string | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    type: string;
    dueDate: string | null;
    billingMode: BillingMode;
    serviceAmount: number | null;
  };
  company: {
    name: string;
    phone: string;
    website: string;
    logoUrl: string | null;
    address: {
      postalCode: string;
      street: string;
      number: string;
      complement: string;
      neighborhood: string;
      city: string;
      state: string;
    };
  };
  customer: {
    name: string;
    type: string | null;
    taxId: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
  } | null;
  location: {
    name: string;
    postalCode: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    address: string | null;
  } | null;
  asset: {
    name: string;
    code: string | null;
    status: string;
    category: string | null;
    manufacturer: string | null;
    model: string | null;
    serial: string | null;
    barcode: string | null;
    power: string | null;
    area: string | null;
    inService: string | null;
    warranty: string | null;
    cost: number | null;
    description: string | null;
    extra: string | null;
  } | null;
  tasks: WorkOrderTask[];
  labors: {
    durationSeconds: number;
    hourlyRate: number | null;
    workedOn: string | null;
    fromTimer: boolean;
    author: string;
  }[];
  parts: { name: string; unit: string | null; cost: number; quantity: number }[];
  files: { name: string; url: string }[];
};

async function fetchPublicPrint(id: string): Promise<PublicPrint | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const response = await fetch(`${base}/functions/v1/work-order-public-print`, {
    method: "POST",
    headers: {
      apikey: anon,
      authorization: `Bearer ${anon}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return parsePublicPrint(await response.json());
}

function parsePublicPrint(value: unknown): PublicPrint | null {
  const row = record(value);
  const order = record(row?.order);
  const company = record(row?.company);
  const billingMode = text(order?.billingMode);
  const title = text(order?.title);
  if (!order || !company || !title || !isBillingMode(billingMode)) return null;
  const addressRow = record(company.address);
  return {
    order: {
      customId: text(order.customId) || null,
      title,
      description: text(order.description) || null,
      status: text(order.status),
      priority: text(order.priority),
      type: text(order.type),
      dueDate: text(order.dueDate) || null,
      billingMode,
      serviceAmount: numberOrNull(order.serviceAmount),
    },
    company: {
      name: text(company.name),
      phone: text(company.phone),
      website: text(company.website),
      logoUrl: text(company.logoUrl) || null,
      address: {
        postalCode: text(addressRow?.postalCode),
        street: text(addressRow?.street),
        number: text(addressRow?.number),
        complement: text(addressRow?.complement),
        neighborhood: text(addressRow?.neighborhood),
        city: text(addressRow?.city),
        state: text(addressRow?.state),
      },
    },
    customer: parseCustomer(row?.customer),
    location: parseLocation(row?.location),
    asset: parseAsset(row?.asset),
    tasks: Array.isArray(row?.tasks) ? row.tasks.flatMap(parseTask) : [],
    labors: Array.isArray(row?.labors) ? row.labors.flatMap(parseLabor) : [],
    parts: Array.isArray(row?.parts) ? row.parts.flatMap(parsePart) : [],
    files: Array.isArray(row?.files) ? row.files.flatMap(parseFile) : [],
  };
}

function parseCustomer(value: unknown): PublicPrint["customer"] {
  const row = record(value);
  const name = text(row?.name);
  if (!row || !name) return null;
  return {
    name,
    type: text(row.type) || null,
    taxId: text(row.taxId) || null,
    phone: text(row.phone) || null,
    email: text(row.email) || null,
    description: text(row.description) || null,
  };
}

function parseLocation(value: unknown): PublicPrint["location"] {
  const row = record(value);
  const name = text(row?.name);
  if (!row || !name) return null;
  return {
    name,
    postalCode: text(row.postalCode),
    street: text(row.street),
    number: text(row.number),
    complement: text(row.complement),
    neighborhood: text(row.neighborhood),
    city: text(row.city),
    state: text(row.state),
    address: text(row.address) || null,
  };
}

function parseAsset(value: unknown): PublicPrint["asset"] {
  const row = record(value);
  const name = text(row?.name);
  if (!row || !name) return null;
  return {
    name,
    code: text(row.code) || null,
    status: text(row.status),
    category: text(row.category) || null,
    manufacturer: text(row.manufacturer) || null,
    model: text(row.model) || null,
    serial: text(row.serial) || null,
    barcode: text(row.barcode) || null,
    power: text(row.power) || null,
    area: text(row.area) || null,
    inService: text(row.inService) || null,
    warranty: text(row.warranty) || null,
    cost: numberOrNull(row.cost),
    description: text(row.description) || null,
    extra: text(row.extra) || null,
  };
}

function parseTask(value: unknown): WorkOrderTask[] {
  const row = record(value);
  const label = text(row?.label);
  const taskType = text(row?.taskType);
  if (!row || !label || !isTaskType(taskType)) return [];
  return [{
    label,
    taskType,
    options: [],
    value: text(row.value) || null,
    comment: text(row.comment) || null,
    executedAt: text(row.executedAt) || null,
  }];
}

function parseLabor(value: unknown): PublicPrint["labors"] {
  const row = record(value);
  if (!row) return [];
  return [{
    durationSeconds: numberOrNull(row.durationSeconds) ?? 0,
    hourlyRate: numberOrNull(row.hourlyRate),
    workedOn: text(row.workedOn) || null,
    fromTimer: row.fromTimer === true,
    author: text(row.author) || "Usuário",
  }];
}

function parsePart(value: unknown): PublicPrint["parts"] {
  const row = record(value);
  const name = text(row?.name);
  if (!row || !name) return [];
  return [{
    name,
    unit: text(row.unit) || null,
    cost: numberOrNull(row.cost) ?? 0,
    quantity: numberOrNull(row.quantity) ?? 0,
  }];
}

function parseFile(value: unknown): PublicPrint["files"] {
  const row = record(value);
  const name = text(row?.name);
  if (!row || !name) return [];
  return [{ name, url: text(row.url) }];
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

function isTaskType(value: string): value is TaskType {
  return value === "SUBTASK" || value === "TEXT" || value === "NUMBER" || value === "INSPECTION" || value === "MULTIPLE";
}

function printTask(task: WorkOrderTask) {
  const when = splitWhen(task.executedAt ?? null);
  const pending = !task.value;
  const answer = taskAnswerLabel(task);
  let tone: PrintTone | null = null;
  let mark: string | null = null;
  if (!pending && task.taskType === "SUBTASK") {
    tone = "ok";
    mark = "✓";
  } else if (!pending && task.taskType === "INSPECTION") {
    mark = "●";
    tone = task.value === "FAIL" ? "bad" : task.value === "FLAG" ? "warn" : "ok";
  }
  return {
    label: task.label,
    type: PAGE_TASK_TYPE[task.taskType] ?? taskTypeLabel(task.taskType).toLowerCase(),
    answer: pending ? "Pendente" : answer,
    tone,
    mark,
    comment: task.comment?.trim() || "—",
    pending,
    day: pending ? null : when.day === "—" ? null : when.day,
    time: pending ? null : when.time?.replace(/^às /, "") ?? null,
  };
}

function statusTone(status: string): PrintTone {
  if (status === "COMPLETE") return "ok";
  if (status === "IN_PROGRESS") return "info";
  if (status === "ON_HOLD") return "warn";
  return "gray";
}

function priorityTone(priority: string): PrintTone {
  if (priority === "HIGH") return "bad";
  if (priority === "MEDIUM") return "warn";
  if (priority === "LOW") return "ok";
  return "gray";
}

function assetTone(status: string): PrintTone {
  if (status === "OPERATIONAL" || status === "COMMISSIONING") return "ok";
  if (status === "MODERNIZATION") return "info";
  if (status === "STANDBY" || status === "INSPECTION_SCHEDULED") return "warn";
  if (status === "DOWN" || status === "EMERGENCY_SHUTDOWN") return "bad";
  return "gray";
}

function lineAddress(parts: {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}) {
  const city = [parts.city.trim(), parts.state.trim()].filter(Boolean).join(" - ");
  const cep = parts.postalCode.trim() ? formatCep(parts.postalCode) : "";
  return [parts.street.trim(), parts.number.trim(), parts.complement.trim(), parts.neighborhood.trim(), city, cep]
    .filter(Boolean)
    .join(", ");
}

function taxLine(value: string | null) {
  const formatted = formatTaxId(value);
  if (!formatted) return null;
  const kind = taxDigits(value).length > 11 ? "CNPJ" : "CPF";
  return `${kind} ${formatted}`;
}

function websiteLabel(value: string) {
  const clean = value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return clean || null;
}

function websiteHref(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : name.trim().slice(0, 2);
  return letters.toUpperCase() || "AH";
}

function splitWhen(value: string | null) {
  if (!value) return { day: "—", time: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "—", time: null };
  return {
    day: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(date),
    time: `às ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date)}`,
  };
}

function formatDateOnly(value: string | null) {
  if (!value) return "—";
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  return splitWhen(value).day;
}

function formatHourCount(seconds: number) {
  const hours = Math.round((seconds / 3600) * 100) / 100;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(hours);
}
