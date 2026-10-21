"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveWorkOrderTaskAnswers } from "@/app/(app)/work-orders/activity-actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import {
  INSPECTION_ANSWERS,
  SUBTASK_ANSWERS,
  type WorkOrderTask,
} from "@/lib/work-orders/tasks";

export function WorkOrderTasksDialog({
  order,
  onOpenChange,
}: {
  order: WorkOrderRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!order) return;
    setError(null);
    setDraft(
      Object.fromEntries(order.tasks.map((task) => [task.id ?? task.label, task.value ?? ""])),
    );
  }, [order]);

  async function save() {
    if (!order) return;
    const answers = order.tasks
      .filter((task): task is WorkOrderTask & { id: string } => Boolean(task.id))
      .map((task) => ({ id: task.id, value: draft[task.id] ?? "" }));
    setPending(true);
    const result = await saveWorkOrderTaskAnswers(order.id, answers);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onOpenChange(false);
  }

  return (
    <FormDialog
      open={order !== null}
      onOpenChange={onOpenChange}
      title="Responder tarefas"
      description={order ? order.title : "Respostas da ordem de serviço."}
    >
      {order ? (
        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {order.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta ordem não tem tarefas.</p>
          ) : (
            <ul className="space-y-3">
              {order.tasks.map((task) => (
                <li key={task.id ?? task.label} className="space-y-1">
                  <p className="text-sm font-medium">{task.label}</p>
                  <TaskAnswer
                    task={task}
                    value={draft[task.id ?? task.label] ?? ""}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        [task.id ?? task.label]: value,
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-9 font-semibold"
              disabled={pending || order.tasks.length === 0}
              onClick={save}
            >
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
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
    task.taskType === "SUBTASK"
      ? SUBTASK_ANSWERS
      : task.taskType === "INSPECTION"
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
