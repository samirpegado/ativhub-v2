"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { createPreventive } from "@/app/(app)/preventive/actions";
import { PreventiveAssetPicker } from "@/components/preventive/preventive-asset-picker";
import { TaskEditor } from "@/components/work-orders/task-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import type { MutationState } from "@/lib/forms/state";
import type { PreventivePerson, PreventiveRecord, PreventiveTeam } from "@/lib/preventive/queries";
import {
  RECURRENCE_BASES,
  RECURRENCE_TYPES,
  WEEKDAYS,
  type RecurrenceBase,
  type RecurrenceType,
} from "@/lib/preventive/schedule";
import { WORK_ORDER_PRIORITIES } from "@/lib/work-orders/status";
import type { WorkOrderTask } from "@/lib/work-orders/tasks";

function dateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function personLabel(person: PreventivePerson) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Usuário";
}

export function PreventiveForm({
  schedule,
  people,
  teams,
  checklists,
  onCancel,
  onSuccess,
}: {
  schedule?: PreventiveRecord;
  people: PreventivePerson[];
  teams: PreventiveTeam[];
  checklists: ChecklistRecord[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = createPreventive;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);
  const [basedOn, setBasedOn] = useState<RecurrenceBase>(
    schedule?.recurrenceBasedOn === "COMPLETED_DATE" ? "COMPLETED_DATE" : "SCHEDULED_DATE",
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    schedule?.recurrenceType === "DAILY" ||
      schedule?.recurrenceType === "WEEKLY" ||
      schedule?.recurrenceType === "MONTHLY" ||
      schedule?.recurrenceType === "YEARLY"
      ? schedule.recurrenceType
      : "MONTHLY",
  );
  const [days, setDays] = useState<number[]>(schedule?.daysOfWeek ?? []);
  const savedAssetIds = schedule?.assetIds?.length ? schedule.assetIds : schedule?.assetId ? [schedule.assetId] : [];
  const [tasks, setTasks] = useState<WorkOrderTask[]>(schedule?.tasks ?? []);
  const [clientError, setClientError] = useState<string | null>(null);
  const [name, setName] = useState(schedule?.name ?? "");
  const [frequency, setFrequency] = useState(String(schedule?.frequency ?? 1));
  const [startsOn, setStartsOn] = useState(dateInput(schedule?.startsOn ?? null));
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [priority, setPriority] = useState(
    schedule?.priority && schedule.priority !== "NONE" ? schedule.priority : "",
  );
  const [dueDelay, setDueDelay] = useState(schedule?.dueDateDelay == null ? "" : String(schedule.dueDateDelay));
  const [assigneeIds, setAssigneeIds] = useState<string[]>(schedule?.primaryUserId ? [schedule.primaryUserId] : []);
  const [assetCount, setAssetCount] = useState(savedAssetIds.length);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  const showDays = recurrenceType === "WEEKLY" && basedOn === "SCHEDULED_DATE";

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  function validate(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const assets = data.getAll("asset_ids").filter((value) => String(value).trim());
    const assignees = data.getAll("assignee_ids").filter((value) => String(value).trim());
    if (assignees.length === 0) {
      event.preventDefault();
      setClientError("Selecione pelo menos um responsável.");
      return;
    }
    if (assets.length === 0) {
      event.preventDefault();
      setClientError("Selecione pelo menos um ativo.");
      return;
    }
    if (tasks.length === 0) {
      event.preventDefault();
      setClientError("Adicione pelo menos uma tarefa.");
      return;
    }
    setClientError(null);
  }

  const frequencyNumber = Number(frequency);
  const dueNumber = Number(dueDelay);
  const missing = [
    name.trim() ? null : "nome",
    Number.isInteger(frequencyNumber) && frequencyNumber >= 1 ? null : "a cada",
    startsOn.trim() ? null : "começa em",
    !showDays || days.length > 0 ? null : "dias da semana",
    title.trim() ? null : "título",
    priority === "LOW" || priority === "MEDIUM" || priority === "HIGH" ? null : "prioridade",
    dueDelay.trim() && Number.isInteger(dueNumber) && dueNumber >= 0 ? null : "vencimento",
    assigneeIds.length > 0 ? null : "responsáveis",
    assetCount > 0 ? null : "ativos",
    tasks.length > 0 ? null : "tarefas",
  ].filter((item): item is string => Boolean(item));
  const ready = missing.length === 0;

  const error = clientError ?? state?.error;

  return (
    <form action={formAction} className="space-y-4" onSubmit={validate}>
      {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
      <input type="hidden" name="days_of_week" value={showDays ? days.join(",") : ""} />
      <input type="hidden" name="tasks_json" value={JSON.stringify(tasks)} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <h3 className="font-semibold">Agendamento</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome deste agendamento"
            className="h-9"
            autoFocus
          />
        </Field>
        <Field label="Repetir com base em" htmlFor="recurrence_based_on" required>
          <NativeSelect
            id="recurrence_based_on"
            name="recurrence_based_on"
            className="h-9"
            value={basedOn}
            onChange={(event) => setBasedOn(event.target.value as RecurrenceBase)}
          >
            {RECURRENCE_BASES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="A cada" htmlFor="frequency" required>
          <div className="flex gap-2">
            <Input
              id="frequency"
              name="frequency"
              type="number"
              min={1}
              required
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              className="h-9 w-24"
            />
            <NativeSelect
              id="recurrence_type"
              name="recurrence_type"
              className="h-9"
              value={recurrenceType}
              onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType)}
            >
              {RECURRENCE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Field>
        <Field label="Começa em" htmlFor="starts_on" required>
          <Input
            id="starts_on"
            name="starts_on"
            type="date"
            required
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Termina em" htmlFor="ends_on">
          <Input
            id="ends_on"
            name="ends_on"
            type="date"
            defaultValue={dateInput(schedule?.endsOn ?? null)}
            className="h-9"
          />
        </Field>
        {showDays ? (
          <Field label="Nos dias" required className="sm:col-span-2">
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((label, index) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={days.includes(index)}
                    onChange={() => toggleDay(index)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        ) : null}
      </div>

      <h3 className="font-semibold">Ordem que será criada</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor="title" required className="sm:col-span-2">
          <Input
            id="title"
            name="title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="O que precisa ser feito"
            className="h-9"
          />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea
            id="description"
            name="description"
            defaultValue={schedule?.description ?? ""}
            rows={3}
          />
        </Field>
        <Field label="Prioridade" htmlFor="priority" required>
          <NativeSelect
            id="priority"
            name="priority"
            required
            className="h-9"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">Selecione</option>
            {WORK_ORDER_PRIORITIES.filter((item) => item.value !== "NONE").map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vencimento (dias depois)" htmlFor="due_date_delay" required>
          <Input
            id="due_date_delay"
            name="due_date_delay"
            type="number"
            min={0}
            required
            value={dueDelay}
            onChange={(event) => setDueDelay(event.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Duração estimada (h)" htmlFor="estimated_duration">
          <Input
            id="estimated_duration"
            name="estimated_duration"
            type="number"
            min={0}
            step="0.5"
            defaultValue={schedule?.estimatedDuration ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Equipe" htmlFor="team_id">
          <NativeSelect
            id="team_id"
            name="team_id"
            className="h-9"
            defaultValue={schedule?.teamId ?? ""}
          >
            <option value="">Nenhuma</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Responsáveis" required className="sm:col-span-2">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pessoa cadastrada.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-white p-2">
              {people.map((person) => (
                <label key={person.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    name="assignee_ids"
                    value={person.id}
                    className="size-4 accent-primary"
                    checked={assigneeIds.includes(person.id)}
                    onChange={() => {
                      setAssigneeIds((current) =>
                        current.includes(person.id)
                          ? current.filter((id) => id !== person.id)
                          : [...current, person.id],
                      );
                    }}
                  />
                  {personLabel(person)}
                </label>
              ))}
            </div>
          )}
        </Field>
        <Field label="Ativos" required className="sm:col-span-2">
          <PreventiveAssetPicker assetIds={savedAssetIds} onCountChange={setAssetCount} />
        </Field>
      </div>
      <Field label="Tarefas" required>
        <TaskEditor tasks={tasks} checklists={checklists} onChange={setTasks} />
      </Field>
      <FormActions pending={pending} disabled={!ready} onCancel={onCancel} />
      {missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">Falta preencher: {missing.join(", ")}.</p>
      ) : null}
    </form>
  );
}
