"use client";

import { useActionState, useEffect, useState } from "react";
import { TaskEditor } from "@/components/work-orders/task-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import {
  createChecklist,
  updateChecklist,
} from "@/app/(app)/checklists/actions";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import type { MutationState } from "@/lib/forms/state";
import type { WorkOrderTask } from "@/lib/work-orders/tasks";

export function ChecklistForm({
  checklist,
  onCancel,
  onSuccess,
}: {
  checklist?: ChecklistRecord;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = checklist ? updateChecklist : createChecklist;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );
  const [tasks, setTasks] = useState<WorkOrderTask[]>(checklist?.tasks ?? []);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {checklist ? <input type="hidden" name="id" value={checklist.id} /> : null}
      <input type="hidden" name="tasks_json" value={JSON.stringify(tasks)} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Field label="Nome" htmlFor="checklist_name" required>
        <Input
          id="checklist_name"
          name="name"
          required
          defaultValue={checklist?.name}
          className="h-9"
          autoFocus
        />
      </Field>
      <Field label="Tarefas">
        <TaskEditor
          tasks={tasks}
          checklists={[]}
          showLibrary={false}
          onChange={setTasks}
        />
      </Field>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
