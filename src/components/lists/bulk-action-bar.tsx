"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MutationState } from "@/lib/forms/state";

export type BulkAction = {
  label: string;
  destructive?: boolean;
  confirm?: (count: number) => string;
  run?: (ids: string[]) => Promise<MutationState>;
  onSelect?: () => void;
};

export function BulkActionBar({
  count,
  ids,
  actions,
  onClear,
}: {
  count: number;
  ids: string[];
  actions: BulkAction[];
  onClear: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  return (
    <div className="space-y-2 px-4 pb-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2">
        <p className="mr-auto text-sm font-medium">
          {count === 1 ? "1 selecionado" : `${count} selecionados`}
        </p>
        {actions.map((action) => (
          <Button
            key={action.label}
            type="button"
            size="sm"
            variant={action.destructive ? "destructive" : "outline"}
            disabled={pending}
            onClick={() => {
              if (action.onSelect) {
                action.onSelect();
                return;
              }
              if (!action.confirm || !action.run) return;
              if (!window.confirm(action.confirm(count))) return;
              startTransition(async () => {
                const result = await action.run?.(ids);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setError(null);
                onClear();
              });
            }}
          >
            {action.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onClear}>
          Limpar
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
