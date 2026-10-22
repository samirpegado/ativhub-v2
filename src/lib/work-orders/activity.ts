export type WorkOrderTimer = {
  durationSeconds: number;
  startedAt: string | null;
  hourlyRate: number | null;
};

export type WorkOrderLabor = {
  id: string;
  durationSeconds: number;
  workedOn: string | null;
  hourlyRate: number | null;
  author: string;
};

export type WorkOrderFile = {
  id: string;
  name: string;
  url: string;
};

export type WorkOrderUpdate = {
  id: string;
  body: string;
  createdAt: string;
  author: string;
};

export type WorkOrderPartLine = {
  id: string;
  partId: string;
  name: string;
  unit: string | null;
  cost: number;
  quantity: number;
  nonStock: boolean;
};

export type WorkOrderPartOption = {
  id: string;
  name: string;
  unit: string | null;
  cost: number;
  quantity: number;
  nonStock: boolean;
};

export type WorkOrderActivity = {
  timer: WorkOrderTimer | null;
  labors: WorkOrderLabor[];
  files: WorkOrderFile[];
  updates: WorkOrderUpdate[];
  parts: WorkOrderPartLine[];
  partOptions: WorkOrderPartOption[];
};

export function formatDuration(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours === 0 && minutes === 0) return `${seconds}s`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function liveDuration(timer: WorkOrderTimer | null, now: number) {
  if (!timer) return 0;
  if (!timer.startedAt) return timer.durationSeconds;
  const elapsed = Math.floor((now - new Date(timer.startedAt).getTime()) / 1000);
  return timer.durationSeconds + Math.max(0, elapsed);
}
