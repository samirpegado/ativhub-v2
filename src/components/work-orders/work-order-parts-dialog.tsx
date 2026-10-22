"use client";

import { useEffect, useState } from "react";
import { addWorkOrderPart } from "@/app/(app)/work-orders/activity-actions";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatQuantity } from "@/lib/inventory/format";
import type { WorkOrderActivity, WorkOrderPartOption } from "@/lib/work-orders/activity";

export function WorkOrderPartsDialog({
  open,
  workOrderId,
  options,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  workOrderId: string;
  options: WorkOrderPartOption[];
  onOpenChange: (open: boolean) => void;
  onAdded: (activity: WorkOrderActivity) => void;
}) {
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const selected = options.find((part) => part.id === partId) ?? null;

  useEffect(() => {
    if (!open) return;
    setPartId("");
    setQuantity("1");
    setError(null);
  }, [open]);

  async function save() {
    setPending(true);
    const result = await addWorkOrderPart(workOrderId, partId, quantity);
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
      title="Adicionar peças"
      description="Escolha uma peça do inventário e a quantidade usada nesta ordem."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre peças no inventário para usá-las aqui.
          </p>
        ) : (
          <>
            <Field
              label="Peça"
              htmlFor="work_order_part_id"
              required
              hint={
                selected
                  ? selected.nonStock
                    ? "Sem controle de estoque."
                    : `Disponível: ${formatQuantity(selected.quantity, selected.unit)}`
                  : undefined
              }
            >
              <NativeSelect
                id="work_order_part_id"
                value={partId}
                className="h-9"
                onChange={(event) => setPartId(event.target.value)}
              >
                <option value="">Selecione</option>
                {options.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.name}
                    {part.nonStock
                      ? " · sem controle de estoque"
                      : ` · ${formatQuantity(part.quantity, part.unit)}`}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Quantidade" htmlFor="work_order_part_qty" required>
              <Input
                id="work_order_part_qty"
                inputMode="decimal"
                value={quantity}
                className="h-9"
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="h-9 font-semibold"
            disabled={pending || options.length === 0 || !partId}
          >
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
