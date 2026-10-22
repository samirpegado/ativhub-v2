"use client";

import { useActionState, useEffect, useState } from "react";
import { TaskEditor } from "@/components/work-orders/task-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkOrderTask } from "@/lib/work-orders/tasks";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { ASSET_STATUSES } from "@/lib/assets/status";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import type { LocationOption } from "@/lib/locations/queries";
import type { MutationState } from "@/lib/forms/state";
import type { PersonRecord, TeamRecord } from "@/lib/people/queries";
import { BILLING_MODES, isBillingMode } from "@/lib/work-orders/billing";
import type { WorkOrderRecord } from "@/lib/work-orders/queries";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
} from "@/lib/work-orders/status";
import {
  createWorkOrder,
  updateWorkOrder,
} from "@/app/(app)/work-orders/actions";

type AssetOption = {
  id: string;
  name: string;
  custom_id: string | null;
  location_id: string | null;
};

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function personLabel(person: PersonRecord) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

export function WorkOrderForm({
  order,
  locations,
  assets,
  people,
  teams,
  checklists,
  initialDueDate,
  onCancel,
  onSuccess,
}: {
  order?: WorkOrderRecord;
  initialDueDate?: string | null;
  locations: LocationOption[];
  assets: AssetOption[];
  people: PersonRecord[];
  teams: TeamRecord[];
  checklists: ChecklistRecord[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = order ? updateWorkOrder : createWorkOrder;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );
  const [locationId, setLocationId] = useState(order?.locationId ?? "");
  const [assetId, setAssetId] = useState(order?.assetId ?? "");
  const [tasks, setTasks] = useState<WorkOrderTask[]>(order?.tasks ?? []);
  const [billingMode, setBillingMode] = useState(order?.billingMode ?? "NONE");

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  const visibleAssets = locationId
    ? assets.filter((asset) => asset.location_id === locationId)
    : assets;

  return (
    <form action={formAction} className="space-y-4">
      {order ? <input type="hidden" name="id" value={order.id} /> : null}
      <input type="hidden" name="tasks_json" value={JSON.stringify(tasks)} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor="title" required className="sm:col-span-2">
          <Input
            id="title"
            name="title"
            required
            defaultValue={order?.title}
            placeholder="O que precisa ser feito"
            className="h-9"
            autoFocus
          />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea
            id="description"
            name="description"
            defaultValue={order?.description ?? ""}
            rows={3}
          />
        </Field>
        <Field label="Prioridade" htmlFor="priority">
          <NativeSelect
            id="priority"
            name="priority"
            className="h-9"
            defaultValue={order?.priority ?? "NONE"}
          >
            {WORK_ORDER_PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor="status">
          <NativeSelect
            id="status"
            name="status"
            className="h-9"
            defaultValue={order?.status ?? "OPEN"}
          >
            {WORK_ORDER_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vencimento" htmlFor="due_date">
          <Input
            id="due_date"
            name="due_date"
            type="datetime-local"
            defaultValue={toDatetimeLocal(order?.dueDate ?? initialDueDate ?? null)}
            className="h-9"
          />
        </Field>
        <Field label="Início estimado" htmlFor="estimated_start_date">
          <Input
            id="estimated_start_date"
            name="estimated_start_date"
            type="datetime-local"
            defaultValue={toDatetimeLocal(order?.estimatedStartDate ?? null)}
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
            defaultValue={order?.estimatedDuration ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Equipe" htmlFor="team_id">
          <NativeSelect
            id="team_id"
            name="team_id"
            className="h-9"
            defaultValue={order?.teamId ?? ""}
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
            defaultValue={order?.primaryUserId ?? ""}
          >
            <option value="">Nenhum</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {personLabel(person)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Localização" htmlFor="location_id">
          <NativeSelect
            id="location_id"
            name="location_id"
            className="h-9"
            value={locationId}
            onChange={(event) => {
              const next = event.target.value;
              setLocationId(next);
              const asset = assets.find((item) => item.id === assetId);
              if (asset && next && asset.location_id !== next) setAssetId("");
            }}
          >
            <option value="">Nenhuma</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.custom_id ? `${location.custom_id} · ` : ""}
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Ativo" htmlFor="asset_id">
          <NativeSelect
            id="asset_id"
            name="asset_id"
            className="h-9"
            value={assetId}
            onChange={(event) => {
              const next = event.target.value;
              setAssetId(next);
              const asset = assets.find((item) => item.id === next);
              if (asset?.location_id) setLocationId(asset.location_id);
            }}
          >
            <option value="">Nenhum</option>
            {visibleAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.custom_id ? `${asset.custom_id} · ` : ""}
                {asset.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Cobrança" htmlFor="billing_mode">
          <NativeSelect
            id="billing_mode"
            name="billing_mode"
            className="h-9"
            value={billingMode}
            onChange={(event) => {
              const next = event.target.value;
              if (isBillingMode(next)) setBillingMode(next);
            }}
          >
            {BILLING_MODES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {billingMode === "FIXED" ? (
          <Field label="Valor do serviço" htmlFor="service_amount" required>
            <CurrencyInput
              id="service_amount"
              name="service_amount"
              required
              defaultValue={order?.serviceAmount}
              className="h-9"
            />
          </Field>
        ) : null}
        {order ? null : (
          <Field label="Status do ativo" htmlFor="asset_status">
            <NativeSelect id="asset_status" name="asset_status" className="h-9" defaultValue="">
              <option value="">Não alterar</option>
              {ASSET_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Tarefas" className="sm:col-span-2">
          <TaskEditor tasks={tasks} checklists={checklists} onChange={setTasks} />
        </Field>
        <Field label="Responsáveis adicionais" className="sm:col-span-2">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pessoa cadastrada.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
              {people.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    name="assignee_ids"
                    value={person.id}
                    defaultChecked={order?.assigneeIds.includes(person.id)}
                    className="size-4 accent-primary"
                  />
                  {personLabel(person)}
                </label>
              ))}
            </div>
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="required_signature"
            defaultChecked={order?.requiredSignature}
            className="size-4 accent-primary"
          />
          Exige assinatura na conclusão
        </label>
      </div>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
