"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { executeWorkOrderTask } from "@/app/(app)/work-orders/activity-actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import {
  INSPECTION_ANSWERS,
  SUBTASK_DONE,
  subtaskDone,
  taskAnswerLabel,
  type WorkOrderTask,
} from "@/lib/work-orders/tasks";

export function WorkOrderTasksDialog({
  order,
  onOpenChange,
  onExecuted,
}: {
  order: WorkOrderRecord | null;
  onOpenChange: (open: boolean) => void;
  onExecuted: (order: WorkOrderRecord) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, { value: string; comment: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setError(null);
    setDraft(
      Object.fromEntries(
        order.tasks.map((task) => [
          task.id ?? task.label,
          {
            value: savedTaskValue(task),
            comment: task.comment ?? "",
          },
        ]),
      ),
    );
  }, [order]);

  async function register(task: WorkOrderTask & { id: string }) {
    if (!order) return;
    const current = draft[task.id] ?? { value: "", comment: "" };
    setPendingId(task.id);
    const result = await executeWorkOrderTask(order.id, task.id, current);
    setPendingId(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    if (result.order) onExecuted(result.order);
    router.refresh();
  }

  return (
    <FormDialog
      open={order !== null}
      onOpenChange={onOpenChange}
      title="Executar tarefas"
      description={order ? order.title : "Cada tarefa registra a própria data e hora."}
    >
      {order ? (
        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {order.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta ordem não tem tarefas.</p>
          ) : (
            <ul className="space-y-4">
              {order.tasks.map((task) => {
                const key = task.id ?? task.label;
                const current = draft[key] ?? { value: "", comment: "" };
                return (
                  <li key={key} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{task.label}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {task.executedAt ? formatWhen(task.executedAt) : "Pendente"}
                      </span>
                    </div>
                    <TaskAnswer
                      task={task}
                      value={current.value}
                      onChange={(value) =>
                        setDraft((items) => ({ ...items, [key]: { ...current, value } }))
                      }
                    />
                    <Textarea
                      rows={2}
                      value={current.comment}
                      placeholder="Comentário da execução"
                      onChange={(event) =>
                        setDraft((items) => ({
                          ...items,
                          [key]: { ...current, comment: event.target.value },
                        }))
                      }
                    />
                    {task.id ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          className="h-9"
                          disabled={pendingId !== null}
                          onClick={() => register({ ...task, id: task.id as string })}
                        >
                          {pendingId === task.id ? "Registrando..." : "Registrar"}
                        </Button>
                      </div>
                    ) : null}
                    {task.executedAt && task.value ? (
                      <p className="text-xs text-muted-foreground">
                        Última resposta: {taskAnswerLabel(task)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
}

export function WorkOrderTaskDialog({
  order,
  task,
  onOpenChange,
  onExecuted,
}: {
  order: WorkOrderRecord | null;
  task: (WorkOrderTask & { id: string }) | null;
  onOpenChange: (open: boolean) => void;
  onExecuted: (order: WorkOrderRecord) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const taskId = task?.id ?? null;
  const savedValue = task ? savedTaskValue(task) : "";
  const savedComment = task?.comment ?? "";

  useEffect(() => {
    setError(null);
    setPending(false);
    setValue(savedValue);
    setComment(savedComment);
  }, [taskId, savedValue, savedComment]);

  async function register() {
    if (!order || !task) return;
    setPending(true);
    const result = await executeWorkOrderTask(order.id, task.id, { value, comment });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (result.order) onExecuted(result.order);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormDialog
      open={order !== null && task !== null}
      onOpenChange={onOpenChange}
      title={task?.label ?? "Executar tarefa"}
      description="Registre a execução desta tarefa. A data e a hora ficam gravadas."
    >
      {task ? (
        <div className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <TaskAnswer task={task} value={value} onChange={setValue} />
          <Textarea
            rows={3}
            value={comment}
            placeholder="Comentário da execução"
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" className="h-9" disabled={pending} onClick={() => void register()}>
              {pending ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
}

function savedTaskValue(task: WorkOrderTask) {
  return task.taskType === "SUBTASK" ? (subtaskDone(task.value) ? SUBTASK_DONE : "") : (task.value ?? "");
}

function TaskAnswer({
  task,
  value,
  onChange,
}: {
  task: WorkOrderTask;
  value: string;
  onChange: (value: string) => void;
}) {
  if (task.taskType === "SUBTASK") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={value === SUBTASK_DONE}
          onChange={(event) => onChange(event.target.checked ? SUBTASK_DONE : "")}
        />
        Concluída
      </label>
    );
  }

  if (task.taskType === "TEXT" || task.taskType === "NUMBER") {
    return (
      <Input
        type={task.taskType === "NUMBER" ? "number" : "text"}
        value={value}
        className="h-9"
        placeholder="Resposta"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const choices =
    task.taskType === "INSPECTION"
      ? INSPECTION_ANSWERS
      : task.options.map((option) => ({ value: option, label: option }));

  return (
    <NativeSelect className="h-9" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Não preenchido</option>
      {choices.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
