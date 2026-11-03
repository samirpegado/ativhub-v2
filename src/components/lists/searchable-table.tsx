"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { BulkActionBar, type BulkAction } from "@/components/lists/bulk-action-bar";
import { RowCheckbox } from "@/components/lists/row-checkbox";
import { TablePagination } from "@/components/lists/table-pagination";
import { useRowSelection } from "@/components/lists/use-row-selection";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
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
  onOpen,
  extraActions,
  manage = true,
  selectable = false,
  bulkActions = [],
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
    cells: ReactNode[];
  }[];
  deleteAction: (
    prev: MutationState,
    formData: FormData,
  ) => Promise<MutationState>;
  deleteNoun: string;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onQr?: (id: string) => void;
  onOpen?: (id: string) => void;
  extraActions?: ReactNode;
  manage?: boolean;
  selectable?: boolean;
  bulkActions?: BulkAction[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    deleteAction,
    undefined,
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.searchText.includes(needle));
  }, [query, rows]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * LIST_PAGE_SIZE,
    currentPage * LIST_PAGE_SIZE,
  );
  const selection = useRowSelection(pageRows.map((row) => row.id));
  const showSelection = selectable && manage && bulkActions.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {extraActions}
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
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
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
        {showSelection ? (
          <BulkActionBar
            count={selection.count}
            ids={selection.ids}
            actions={bulkActions}
            onClear={selection.clear}
          />
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
                  {showSelection ? (
                    <th className="w-10 px-4 py-3">
                      <RowCheckbox
                        checked={selection.allPage}
                        indeterminate={selection.somePage}
                        label="Selecionar os registros desta página"
                        onChange={selection.togglePage}
                      />
                    </th>
                  ) : null}
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
                {pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      onOpen
                        ? "cursor-pointer border-b last:border-0 hover:bg-muted/40"
                        : "border-b last:border-0"
                    }
                    onClick={onOpen ? () => onOpen(row.id) : undefined}
                  >
                    {showSelection ? (
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <RowCheckbox
                          checked={selection.isSelected(row.id)}
                          label={`Selecionar ${row.name}`}
                          onChange={() => selection.toggle(row.id)}
                        />
                      </td>
                    ) : null}
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
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
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
        <TablePagination
          page={currentPage}
          pageSize={LIST_PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}
