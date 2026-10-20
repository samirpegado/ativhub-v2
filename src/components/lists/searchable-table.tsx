"use client";

import { useActionState, useMemo, useState } from "react";
import { Pencil, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { MutationState } from "@/lib/forms/state";

export function SearchableTable({
  createLabel,
  emptyTitle,
  emptyHint,
  searchPlaceholder = "Pesquisar",
  headers,
  rows,
  deleteAction,
  deleteNoun,
  onCreate,
  onEdit,
  onQr,
  manage = true,
}: {
  createLabel: string;
  emptyTitle: string;
  emptyHint: string;
  searchPlaceholder?: string;
  headers: string[];
  rows: {
    id: string;
    name: string;
    searchText: string;
    cells: string[];
  }[];
  deleteAction: (
    prev: MutationState,
    formData: FormData,
  ) => Promise<MutationState>;
  deleteNoun: string;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onQr?: (id: string) => void;
  manage?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    deleteAction,
    undefined,
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.searchText.includes(needle));
  }, [query, rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {manage ? (
          <Button type="button" className="h-9 font-semibold" onClick={onCreate}>
            <Plus />
            {createLabel}
          </Button>
        ) : null}
      </div>

      <Card className="items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]">
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        </div>
        {state?.error ? (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <Separator />
        {filtered.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="max-w-md text-sm font-medium text-foreground">
              {rows.length === 0 ? emptyTitle : "Nenhum resultado para a busca."}
            </p>
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? emptyHint : "Tente outro termo."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-xs font-semibold tracking-wide uppercase"
                    >
                      {header}
                    </th>
                  ))}
                  {manage ? (
                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                      Ações
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    {row.cells.map((cell, index) => (
                      <td
                        key={index}
                        className={
                          index === 0 && headers[0] === "ID"
                            ? "px-4 py-3 align-middle font-mono text-xs text-muted-foreground"
                            : index === 0 || (headers[0] === "ID" && index === 1)
                              ? "px-4 py-3 align-middle font-semibold"
                              : "px-4 py-3 align-middle"
                        }
                      >
                        {cell}
                      </td>
                    ))}
                    {manage ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {onQr ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-foreground hover:bg-muted"
                            aria-label={`Gerar QR code de ${row.name}`}
                            onClick={() => onQr(row.id)}
                          >
                            <QrCode className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-primary hover:bg-primary/10 hover:text-primary"
                          aria-label={`Editar ${row.name}`}
                          onClick={() => onEdit(row.id)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <form
                          action={formAction}
                          onSubmit={(event) => {
                            if (
                              !window.confirm(
                                `Excluir ${deleteNoun} "${row.name}"?`,
                              )
                            ) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remover ${row.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
