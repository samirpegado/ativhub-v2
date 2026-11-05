export type PublicAsset = {
  id: string;
  name: string;
  customId: string | null;
  barCode?: string | null;
  locationName: string | null;
};

export type PublicHistoryItem = {
  id: string;
  customId: string | null;
  title: string;
  description: string | null;
  status: string;
  type: string;
  priority: string;
  at: string;
  billingMode: string;
  partsCost: number;
  laborCost: number;
  serviceCost: number;
  total: number;
};

export type PublicOverview = {
  asset: PublicAsset;
  history: PublicHistoryItem[];
};

export type PublicReport = {
  companyName: string;
  order: {
    customId: string | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    type: string;
    dueDate: string | null;
    completedOn: string | null;
    locationName: string | null;
    assetName: string | null;
    customerName: string | null;
    customerPhone: string | null;
    billingMode: string;
    serviceAmount: number | null;
    primaryUserName: string | null;
    assignees: string[];
  };
  tasks: {
    label: string;
    taskType: string;
    value: string | null;
    comment: string | null;
    executedAt: string | null;
  }[];
  parts: { name: string; unit: string | null; quantity: number; cost: number }[];
  labors: {
    workedOn: string | null;
    durationSeconds: number;
    hourlyRate: number | null;
    author: string;
  }[];
  updates: { body: string; createdAt: string; author: string }[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseAsset(value: unknown): PublicAsset | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    customId: text(row.customId),
    barCode: text(row.barCode),
    locationName: text(row.locationName),
  };
}

function parseHistoryItem(value: unknown): PublicHistoryItem | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.title !== "string") return null;
  return {
    id: row.id,
    customId: text(row.customId),
    title: row.title,
    description: text(row.description),
    status: text(row.status) ?? "OPEN",
    type: text(row.type) ?? "CORRECTIVE",
    priority: text(row.priority) ?? "NONE",
    at: text(row.at) ?? new Date(0).toISOString(),
    billingMode: text(row.billingMode) ?? "NONE",
    partsCost: num(row.partsCost),
    laborCost: num(row.laborCost),
    serviceCost: num(row.serviceCost),
    total: num(row.total),
  };
}

export function parsePublicOverview(value: unknown): PublicOverview | null {
  const row = asRecord(value);
  const asset = parseAsset(row?.asset);
  if (!row || !asset || !Array.isArray(row.history)) return null;
  return {
    asset,
    history: row.history.flatMap((item) => {
      const parsed = parseHistoryItem(item);
      return parsed ? [parsed] : [];
    }),
  };
}

export function parsePublicUnlock(value: unknown): (PublicOverview & { token: string }) | null {
  const overview = parsePublicOverview(value);
  const row = asRecord(value);
  if (!overview || typeof row?.token !== "string") return null;
  return { ...overview, token: row.token };
}

export function parsePublicReport(value: unknown): PublicReport | null {
  const row = asRecord(value);
  const order = asRecord(row?.order);
  if (!row || !order || typeof order.title !== "string") return null;
  const tasks = Array.isArray(row.tasks) ? row.tasks : [];
  const parts = Array.isArray(row.parts) ? row.parts : [];
  const labors = Array.isArray(row.labors) ? row.labors : [];
  const updates = Array.isArray(row.updates) ? row.updates : [];
  const assignees = Array.isArray(order.assignees)
    ? order.assignees.flatMap((item) => (typeof item === "string" && item ? [item] : []))
    : [];

  return {
    companyName: text(row.companyName) ?? "AtivHub",
    order: {
      customId: text(order.customId),
      title: order.title,
      description: text(order.description),
      status: text(order.status) ?? "OPEN",
      priority: text(order.priority) ?? "NONE",
      type: text(order.type) ?? "CORRECTIVE",
      dueDate: text(order.dueDate),
      completedOn: text(order.completedOn),
      locationName: text(order.locationName),
      assetName: text(order.assetName),
      customerName: text(order.customerName),
      customerPhone: text(order.customerPhone),
      billingMode: text(order.billingMode) ?? "NONE",
      serviceAmount: order.serviceAmount == null ? null : num(order.serviceAmount),
      primaryUserName: text(order.primaryUserName),
      assignees,
    },
    tasks: tasks.flatMap((item) => {
      const task = asRecord(item);
      if (!task || typeof task.label !== "string") return [];
      return [{
        label: task.label,
        taskType: text(task.taskType) ?? "TEXT",
        value: text(task.value),
        comment: text(task.comment),
        executedAt: text(task.executedAt),
      }];
    }),
    parts: parts.flatMap((item) => {
      const part = asRecord(item);
      if (!part || typeof part.name !== "string") return [];
      return [{ name: part.name, unit: text(part.unit), quantity: num(part.quantity), cost: num(part.cost) }];
    }),
    labors: labors.flatMap((item) => {
      const labor = asRecord(item);
      if (!labor) return [];
      return [{
        workedOn: text(labor.workedOn),
        durationSeconds: num(labor.durationSeconds),
        hourlyRate: labor.hourlyRate == null ? null : num(labor.hourlyRate),
        author: text(labor.author) ?? "Usuário",
      }];
    }),
    updates: updates.flatMap((item) => {
      const update = asRecord(item);
      if (!update || typeof update.body !== "string") return [];
      return [{
        body: update.body,
        createdAt: text(update.createdAt) ?? "",
        author: text(update.author) ?? "Usuário",
      }];
    }),
  };
}
