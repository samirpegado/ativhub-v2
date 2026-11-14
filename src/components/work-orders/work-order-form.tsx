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
  WORK_ORDER_TYPES,
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
  customers,
  initialDueDate,
  presetAssetId,
  onCancel,
  onSuccess,
}: {
  order?: WorkOrderRecord;
  initialDueDate?: string | null;
  presetAssetId?: string | null;
  locations: LocationOption[];
  assets: AssetOption[];
  people: PersonRecord[];
  teams: TeamRecord[];
  checklists: ChecklistRecord[];
  customers: { id: string; name: string; email: string | null }[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = order ? updateWorkOrder : createWorkOrder;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );
  const savedLocation = locations.find((item) => item.id === order?.locationId);
  const savedCustomerId = order?.customerId || savedLocation?.customer_id || "";
  const savedLocationId = savedLocation && savedLocation.customer_id === savedCustomerId ? savedLocation.id : "";
  const savedAsset = assets.find((item) => item.id === order?.assetId);
  const savedAssetId = savedAsset && savedLocationId && savedAsset.location_id === savedLocationId ? savedAsset.id : "";
  const presetAsset = !order && presetAssetId ? assets.find((item) => item.id === presetAssetId) : undefined;
  const presetLocation = presetAsset?.location_id
    ? locations.find((item) => item.id === presetAsset.location_id)
    : undefined;
  const initialCustomerId = savedCustomerId || presetLocation?.customer_id || "";
  const initialLocationId = savedLocationId || (presetLocation?.customer_id ? presetLocation.id : "");
  const initialAssetId =
    savedAssetId ||
    (presetAsset && initialLocationId && presetAsset.location_id === initialLocationId ? presetAsset.id : "");
  const [locationId, setLocationId] = useState(initialLocationId);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [assetId, setAssetId] = useState(initialAssetId);
  const [tasks, setTasks] = useState<WorkOrderTask[]>(order?.tasks ?? []);
  const [billingMode, setBillingMode] = useState(order?.billingMode ?? "NONE");

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  const visibleLocations = customerId
    ? locations.filter((location) => location.customer_id === customerId)
    : [];
  const visibleAssets = customerId && locationId
    ? assets.filter((asset) => asset.location_id === locationId)
    : [];

  function changeCustomer(next: string) {
    setCustomerId(next);
    setLocationId("");
    setAssetId("");
  }

  function changeLocation(next: string) {
    setLocationId(next);
    setAssetId("");
  }

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
        <Field label="Tipo" htmlFor="type">
          <NativeSelect id="type" name="type" className="h-9" defaultValue={order?.type ?? "CORRECTIVE"}>
            {WORK_ORDER_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Onde será o serviço</p>
            <p className="text-xs text-muted-foreground">Escolha o cliente, depois a localização e, por último, o ativo.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="1. Cliente" htmlFor="customer_id">
              <NativeSelect
                id="customer_id"
                name="customer_id"
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
              label="3. Ativo"
              htmlFor="asset_id"
              hint={!customerId ? "Disponível depois do cliente." : !locationId ? "Disponível depois da localização." : visibleAssets.length === 0 ? "Esta localização não tem ativos." : undefined}
            >
              <NativeSelect
                id="asset_id"
                name="asset_id"
                className="h-9"
                value={assetId}
                disabled={!customerId || !locationId}
                onChange={(event) => setAssetId(event.target.value)}
              >
                <option value="">{locationId ? "Selecione" : customerId ? "Selecione a localização" : "Selecione o cliente"}</option>
                {visibleAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.custom_id ? `${asset.custom_id} · ` : ""}
                    {asset.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>
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
        {billingMode === "HOURLY" ? (
          <Field label="Valor da hora" htmlFor="hourly_amount" required>
            <CurrencyInput
              key="hourly-amount"
              id="hourly_amount"
              name="service_amount"
              required
              defaultValue={order?.billingMode === "HOURLY" ? order.serviceAmount : null}
              className="h-9"
            />
          </Field>
        ) : null}
        {billingMode === "FIXED" ? (
          <Field label="Valor do serviço" htmlFor="service_amount" required>
            <CurrencyInput
              key="fixed-amount"
              id="service_amount"
              name="service_amount"
              required
              defaultValue={order?.billingMode === "FIXED" ? order.serviceAmount : null}
              className="h-9"
            />
          </Field>
        ) : null}
        {assetId ? (
          <>
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
            <Field label="Quando o status vale" htmlFor="asset_status_at">
              <Input
                id="asset_status_at"
                name="asset_status_at"
                type="datetime-local"
                defaultValue={toDatetimeLocal(new Date().toISOString())}
                className="h-9"
              />
            </Field>
          </>
        ) : null}
        <Field label="Tarefas" className="sm:col-span-2">
          <TaskEditor tasks={tasks} checklists={checklists} onChange={setTasks} />
        </Field>
        <Field label="Responsáveis" className="sm:col-span-2">
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
      </div>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
