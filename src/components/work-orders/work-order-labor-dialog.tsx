"use client";

import { useEffect, useState } from "react";
import { addWorkOrderLabor } from "@/app/(app)/work-orders/activity-actions";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkOrderActivity } from "@/lib/work-orders/activity";

function todayInput() {
  const date = new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function WorkOrderLaborDialog({
  open,
  workOrderId,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  workOrderId: string;
  onOpenChange: (open: boolean) => void;
  onAdded: (activity: WorkOrderActivity) => void;
}) {
  const [workedOn, setWorkedOn] = useState(todayInput);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWorkedOn(todayInput());
    setHours("0");
    setMinutes("0");
    setError(null);
  }, [open]);

  async function save() {
    setPending(true);
    const result = await addWorkOrderLabor(workOrderId, workedOn, Number(hours), Number(minutes));
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onAdded(result.activity);
    onOpenChange(false);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar tempo"
      description="Informe a data e o tempo gasto nesta ordem."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Field label="Data" htmlFor="labor_worked_on" required>
          <Input
            id="labor_worked_on"
            type="date"
            required
            value={workedOn}
            className="h-9"
            onChange={(event) => setWorkedOn(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horas" htmlFor="labor_hours" required>
            <Input
              id="labor_hours"
              type="number"
              min={0}
              max={999}
              required
              value={hours}
              className="h-9"
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
          <Field label="Minutos" htmlFor="labor_minutes" required>
            <Input
              id="labor_minutes"
              type="number"
              min={0}
              max={59}
              required
              value={minutes}
              className="h-9"
              onChange={(event) => setMinutes(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" className="h-9 font-semibold" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
