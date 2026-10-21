export const TASK_TYPES = [
  { value: "SUBTASK", label: "Status da subtarefa" },
  { value: "TEXT", label: "Campo de texto" },
  { value: "NUMBER", label: "Campo numérico" },
  { value: "INSPECTION", label: "Verificação de inspeção" },
  { value: "MULTIPLE", label: "Múltipla escolha" },
] as const;

export type TaskType = (typeof TASK_TYPES)[number]["value"];

export type WorkOrderTask = {
  id?: string;
  label: string;
  taskType: TaskType;
  options: string[];
  value?: string | null;
};

export const SUBTASK_ANSWERS = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "ON_HOLD", label: "Em espera" },
  { value: "COMPLETE", label: "Concluído" },
] as const;

export const INSPECTION_ANSWERS = [
  { value: "PASS", label: "Aprovado" },
  { value: "FLAG", label: "Atenção" },
  { value: "FAIL", label: "Reprovado" },
] as const;

export function taskAnswerLabel(task: Pick<WorkOrderTask, "taskType" | "value">) {
  if (!task.value) return "—";
  if (task.taskType === "SUBTASK") {
    return SUBTASK_ANSWERS.find((item) => item.value === task.value)?.label ?? task.value;
  }
  if (task.taskType === "INSPECTION") {
    return INSPECTION_ANSWERS.find((item) => item.value === task.value)?.label ?? task.value;
  }
  return task.value;
}

export function parseTaskList(value: unknown): WorkOrderTask[] {
  if (!Array.isArray(value)) throw new Error("Tarefas inválidas.");
  if (value.length > 50) throw new Error("Uma lista pode ter no máximo 50 tarefas.");

  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Tarefas inválidas.");
    const row = item as Record<string, unknown>;
    const label = String(row.label ?? "").trim();
    const taskType = String(row.taskType ?? "");
    if (!label) throw new Error("Remova as tarefas sem nome.");
    if (label.length > 200) {
      throw new Error("O nome da tarefa deve ter no máximo 200 caracteres.");
    }
    if (!isTaskType(taskType)) throw new Error("Tipo de tarefa inválido.");

    const options = Array.isArray(row.options)
      ? row.options.map((option) => String(option ?? "").trim()).filter(Boolean)
      : [];
    if (taskType === "MULTIPLE" && options.length < 2) {
      throw new Error("A múltipla escolha precisa de pelo menos duas opções.");
    }

    const value = typeof row.value === "string" ? row.value.trim() : "";

    return {
      label,
      taskType,
      options: taskType === "MULTIPLE" ? options.slice(0, 20) : [],
      value: value || null,
    };
  });
}

export function isTaskType(value: string): value is TaskType {
  return TASK_TYPES.some((item) => item.value === value);
}

export function taskTypeLabel(value: string) {
  return TASK_TYPES.find((item) => item.value === value)?.label ?? value;
}
