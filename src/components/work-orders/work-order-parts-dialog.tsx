"use client";

import { useEffect, useState } from "react";
import { addWorkOrderPart } from "@/app/(app)/work-orders/activity-actions";
import { searchWorkOrderParts } from "@/app/(app)/work-orders/filter-actions";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQuantity } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";
import type { WorkOrderActivity, WorkOrderPartOption } from "@/lib/work-orders/activity";

export function WorkOrderPartsDialog({
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
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<WorkOrderPartOption[]>([]);
  const [selected, setSelected] = useState<WorkOrderPartOption | null>(null);
  const [searched, setSearched] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTerm("");
    setSelected(null);
    setResults([]);
    setSearched(false);
    setQuantity("1");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void searchWorkOrderParts(term).then((items) => {
        setResults(items);
        setSearched(true);
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, term]);

  async function save() {
    if (!selected) return;
    setPending(true);
    const result = await addWorkOrderPart(workOrderId, selected.id, quantity);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onAdded(result.activity);
    onOpenChange(false);
  }

  const visible = selected && !results.some((part) => part.id === selected.id)
    ? [selected, ...results]
    : results;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar peças"
      description="Busque pelo nome, descrição ou código de barras. A quantidade sai do estoque quando a peça controla estoque."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Field
          label="Peça"
          htmlFor="work_order_part_search"
          required
          hint={
            selected
              ? selected.nonStock
                ? "Sem controle de estoque."
                : `Disponível: ${formatQuantity(selected.quantity, selected.unit)}`
              : "Digite para pesquisar no inventário."
          }
        >
          <Input
            id="work_order_part_search"
            value={term}
            placeholder="Nome, descrição ou código de barras"
            className="h-9"
            onChange={(event) => setTerm(event.target.value)}
          />
          <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-1">
            {visible.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                {searched ? "Nenhuma peça encontrada." : "Buscando..."}
              </p>
            ) : (
              visible.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className={cn(
                    "flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    selected?.id === part.id && "bg-[#eef1ff]",
                  )}
                  onClick={() => setSelected(part)}
                >
                  <span className="font-medium">{part.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {part.nonStock
                      ? "Sem controle de estoque"
                      : formatQuantity(part.quantity, part.unit)}
                  </span>
                </button>
              ))
            )}
          </div>
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" className="h-9 font-semibold" disabled={pending || !selected}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
