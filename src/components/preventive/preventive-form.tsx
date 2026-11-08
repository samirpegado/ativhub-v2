"use client";

import { useActionState, useEffect, useState } from "react";
import { createPreventive, updatePreventive } from "@/app/(app)/preventive/actions";
import { TaskEditor } from "@/components/work-orders/task-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import type { LocationOption } from "@/lib/locations/queries";
import type { MutationState } from "@/lib/forms/state";
import type {
  PreventiveAsset,
  PreventivePerson,
  PreventiveRecord,
  PreventiveTeam,
} from "@/lib/preventive/queries";
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
  locations,
  assets,
  customers,
  people,
  teams,
  checklists,
  onCancel,
  onSuccess,
}: {
  schedule?: PreventiveRecord;
  locations: LocationOption[];
  assets: PreventiveAsset[];
  customers: { id: string; name: string }[];
  people: PreventivePerson[];
  teams: PreventiveTeam[];
  checklists: ChecklistRecord[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = schedule ? updatePreventive : createPreventive;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(action, undefined);
  const [basedOn, setBasedOn] = useState<RecurrenceBase>(
    schedule?.recurrenceBasedOn === "COMPLETED_DATE" ? "COMPLETED_DATE" : "SCHEDULED_DATE",
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    schedule?.recurrenceType === "WEEKLY" ||
      schedule?.recurrenceType === "MONTHLY" ||
      schedule?.recurrenceType === "YEARLY"
      ? schedule.recurrenceType
      : "DAILY",
  );
  const [days, setDays] = useState<number[]>(schedule?.daysOfWeek ?? []);
  const savedLocation = locations.find((item) => item.id === schedule?.locationId);
  const savedCustomerId = savedLocation?.customer_id || "";
  const savedLocationId = savedLocation && savedLocation.customer_id === savedCustomerId ? savedLocation.id : "";
  const savedAssetIds = (schedule?.assetIds?.length ? schedule.assetIds : schedule?.assetId ? [schedule.assetId] : []).filter(
    (id) => {
      const asset = assets.find((item) => item.id === id);
      return Boolean(asset && savedLocationId && asset.location_id === savedLocationId);
    },
  );
  const [customerId, setCustomerId] = useState(savedCustomerId);
  const [locationId, setLocationId] = useState(savedLocationId);
  const [assetIds, setAssetIds] = useState<string[]>(savedAssetIds);
  const [tasks, setTasks] = useState<WorkOrderTask[]>(schedule?.tasks ?? []);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  const showDays = recurrenceType === "WEEKLY" && basedOn === "SCHEDULED_DATE";
  const visibleLocations = customerId
    ? locations.filter((location) => location.customer_id === customerId)
    : [];
  const visibleAssets = customerId && locationId
    ? assets.filter((asset) => asset.location_id === locationId)
    : [];

  function changeCustomer(next: string) {
    setCustomerId(next);
    setLocationId("");
    setAssetIds([]);
  }

  function changeLocation(next: string) {
    setLocationId(next);
    setAssetIds([]);
  }

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
      <input type="hidden" name="days_of_week" value={showDays ? days.join(",") : ""} />
      <input type="hidden" name="tasks_json" value={JSON.stringify(tasks)} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <h3 className="font-semibold">Agendamento</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
          <Input
            id="name"
            name="name"
            required
            defaultValue={schedule?.name}
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
              defaultValue={schedule?.frequency ?? 1}
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
            defaultValue={dateInput(schedule?.startsOn ?? null)}
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
          <Field label="Nos dias" className="sm:col-span-2">
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
            defaultValue={schedule?.title}
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
        <Field label="Prioridade" htmlFor="priority">
          <NativeSelect
            id="priority"
            name="priority"
            className="h-9"
            defaultValue={schedule?.priority ?? "NONE"}
          >
            {WORK_ORDER_PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vence depois de (dias)" htmlFor="due_date_delay">
          <Input
            id="due_date_delay"
            name="due_date_delay"
            type="number"
            min={0}
            defaultValue={schedule?.dueDateDelay ?? ""}
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
        <Field label="Trabalhador principal" htmlFor="primary_user_id">
          <NativeSelect
            id="primary_user_id"
            name="primary_user_id"
            className="h-9"
            defaultValue={schedule?.primaryUserId ?? ""}
          >
            <option value="">Nenhum</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {personLabel(person)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Onde será o serviço</p>
            <p className="text-xs text-muted-foreground">Escolha o cliente, depois a localização e, por último, um ou mais ativos.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="1. Cliente" htmlFor="customer_id">
              <NativeSelect
                id="customer_id"
                className="h-9"
                value={customerId}
                onChange={(event) => changeCustomer(event.target.value)}
              >
                <option value="">Selecione</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="2. Localização"
              htmlFor="location_id"
              hint={customerId ? (visibleLocations.length === 0 ? "Este cliente não tem localizações." : undefined) : "Disponível depois do cliente."}
            >
              <NativeSelect
                id="location_id"
                name="location_id"
                className="h-9"
                value={locationId}
                disabled={!customerId}
                onChange={(event) => changeLocation(event.target.value)}
              >
                <option value="">{customerId ? "Selecione" : "Selecione o cliente"}</option>
                {visibleLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.custom_id ? `${location.custom_id} · ` : ""}
                    {location.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="3. Ativos"
              htmlFor="asset_ids"
              className="sm:col-span-2"
              hint={
                !customerId
                  ? "Disponível depois do cliente."
                  : !locationId
                    ? "Disponível depois da localização."
                    : visibleAssets.length === 0
                      ? "Esta localização não tem ativos."
                      : "Cada ativo gera a própria ordem quando o agendamento vence."
              }
            >
              <div
                id="asset_ids"
                className={`max-h-40 space-y-1 overflow-y-auto rounded-md border bg-white p-2 ${customerId && locationId ? "" : "opacity-50"}`}
              >
                {!customerId || !locationId ? (
                  <p className="text-sm text-muted-foreground">
                    {customerId ? "Selecione a localização." : "Selecione o cliente."}
                  </p>
                ) : visibleAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum ativo nesta localização.</p>
                ) : (
                  visibleAssets.map((asset) => (
                    <label key={asset.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="asset_ids"
                        value={asset.id}
                        checked={assetIds.includes(asset.id)}
                        onChange={(event) => {
                          setAssetIds((current) =>
                            event.target.checked
                              ? [...current, asset.id]
                              : current.filter((id) => id !== asset.id),
                          );
                        }}
                      />
                      {asset.custom_id ? `${asset.custom_id} · ` : ""}
                      {asset.name}
                    </label>
                  ))
                )}
              </div>
            </Field>
          </div>
        </div>
      </div>
      <TaskEditor tasks={tasks} checklists={checklists} onChange={setTasks} />
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
