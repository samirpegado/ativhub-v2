"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteCustomer, deleteVendor } from "@/app/(app)/parties/actions";
import { CustomerForm } from "@/components/parties/customer-form";
import { VendorForm } from "@/components/parties/vendor-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { TablePagination } from "@/components/lists/table-pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MutationState } from "@/lib/forms/state";
import { formatBrl } from "@/lib/money/brl";
import { partyHref, type PartyListQuery } from "@/lib/parties/list-params";
import type { CustomerRecord, VendorRecord } from "@/lib/parties/queries";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import { cn } from "@/lib/utils";

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm">{value || "—"}</p>
    </div>
  );
}

export function PartiesView({
  query,
  canEdit,
  vendors = [],
  customers = [],
  total,
  totalAll,
}: {
  query: PartyListQuery;
  canEdit: boolean;
  vendors?: VendorRecord[];
  customers?: CustomerRecord[];
  total: number;
  totalAll: number;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [editingVendor, setEditingVendor] = useState<VendorRecord | "new" | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | "new" | null>(null);
  const [openVendor, setOpenVendor] = useState<VendorRecord | null>(null);
  const [openCustomer, setOpenCustomer] = useState<CustomerRecord | null>(null);
  const [vendorState, vendorDelete, vendorPending] = useActionState<MutationState, FormData>(deleteVendor, undefined);
  const [customerState, customerDelete, customerPending] = useActionState<MutationState, FormData>(deleteCustomer, undefined);

  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.search) return;
    const handle = window.setTimeout(() => {
      startNavigation(() => {
        router.replace(partyHref({ ...query, search: trimmed, page: 1 }), { scroll: false });
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, router, search]);

  function visit(next: Partial<PartyListQuery> & { page?: number }) {
    startNavigation(() => {
      router.replace(
        partyHref({
          search,
          page: query.page,
          customers: query.customers,
          ...next,
        }),
        { scroll: false },
      );
    });
  }

  const tab = query.customers ? "customers" : "vendors";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {(
            [
              ["vendors", "Fornecedores"],
              ["customers", "Contratantes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => visit({ customers: id === "customers", page: 1 })}
              className={cn(
                "border-b-2 px-3 py-2 text-sm",
                tab === id
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {canEdit ? (
          <Button
            className="h-9 font-semibold"
            onClick={() => (query.customers ? setEditingCustomer("new") : setEditingVendor("new"))}
          >
            <Plus />
            {query.customers ? "Contratante" : "Fornecedor"}
          </Button>
        ) : null}
      </div>

      <Card className={cn("items-stretch overflow-hidden py-4 shadow-[0px_2px_3px_rgba(159,162,191,0.18),0px_1px_1px_rgba(159,162,191,0.32)]", navigating && "opacity-70")}>
        <div className="px-4 pb-3">
          <div className="relative min-w-40">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar" className="h-9 pl-8" />
          </div>
        </div>
        {vendorState?.error || customerState?.error ? (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{vendorState?.error ?? customerState?.error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <Separator />
        {total === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="max-w-md text-sm font-medium">
              {totalAll === 0
                ? query.customers
                  ? "Contratantes são quem contrata o serviço"
                  : "Fornecedores reúnem quem presta serviço ou vende peça"
                : "Nenhum resultado para a busca."}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalAll === 0 ? "Pressione o botão para cadastrar." : "Tente outro termo."}
            </p>
          </div>
        ) : query.customers ? (
          <PartyTable
            headers={["Nome", "Telefone", "E-mail", "Tipo"]}
            rows={customers.map((item) => ({
              id: item.id,
              label: item.name,
              cells: [item.name, item.phone ?? "—", item.email ?? "—", item.customerType ?? "—"],
              onOpen: () => setOpenCustomer(item),
            }))}
            canEdit={canEdit}
            pending={customerPending}
            action={customerDelete}
            onEdit={(id) => setEditingCustomer(customers.find((item) => item.id === id) ?? null)}
          />
        ) : (
          <PartyTable
            headers={["Empresa", "Contato", "Telefone", "Valor/hora"]}
            rows={vendors.map((item) => ({
              id: item.id,
              label: item.companyName,
              cells: [item.companyName, item.name, item.phone ?? "—", item.rate == null ? "—" : formatBrl(item.rate)],
              onOpen: () => setOpenVendor(item),
            }))}
            canEdit={canEdit}
            pending={vendorPending}
            action={vendorDelete}
            onEdit={(id) => setEditingVendor(vendors.find((item) => item.id === id) ?? null)}
          />
        )}
        <TablePagination page={query.page} pageSize={LIST_PAGE_SIZE} total={total} pending={navigating} onPageChange={(page) => visit({ page })} />
      </Card>

      <FormDialog
        open={editingVendor !== null}
        onOpenChange={(open) => {
          if (!open) setEditingVendor(null);
        }}
        title={editingVendor && editingVendor !== "new" ? "Editar fornecedor" : "Novo fornecedor"}
        description="Empresa e contato são obrigatórios."
      >
        {editingVendor ? (
          <VendorForm
            key={editingVendor === "new" ? "new-vendor" : editingVendor.id}
            vendor={editingVendor === "new" ? undefined : editingVendor}
            onCancel={() => setEditingVendor(null)}
            onSuccess={() => setEditingVendor(null)}
          />
        ) : null}
      </FormDialog>

      <FormDialog
        open={editingCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCustomer(null);
        }}
        title={editingCustomer && editingCustomer !== "new" ? "Editar contratante" : "Novo contratante"}
        description="O nome é obrigatório."
      >
        {editingCustomer ? (
          <CustomerForm
            key={editingCustomer === "new" ? "new-customer" : editingCustomer.id}
            customer={editingCustomer === "new" ? undefined : editingCustomer}
            onCancel={() => setEditingCustomer(null)}
            onSuccess={() => setEditingCustomer(null)}
          />
        ) : null}
      </FormDialog>

      <Sheet open={openVendor !== null} onOpenChange={(open) => { if (!open) setOpenVendor(null); }}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{openVendor?.companyName}</SheetTitle>
            <SheetDescription>{openVendor?.name}</SheetDescription>
          </SheetHeader>
          {openVendor ? (
            <div className="space-y-6 px-6 py-5">
              {canEdit ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="h-9" onClick={() => { setEditingVendor(openVendor); setOpenVendor(null); }}>
                    <Pencil />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-destructive"
                    onClick={() => {
                      if (!window.confirm(`Excluir o fornecedor "${openVendor.companyName}"?`)) return;
                      const data = new FormData();
                      data.set("id", openVendor.id);
                      vendorDelete(data);
                      setOpenVendor(null);
                    }}
                  >
                    <Trash2 />
                    Excluir
                  </Button>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail label="Telefone" value={openVendor.phone} />
                <Detail label="E-mail" value={openVendor.email} />
                <Detail label="Site" value={openVendor.website} />
                <Detail label="Tipo" value={openVendor.vendorType} />
                <Detail label="Valor/hora" value={openVendor.rate == null ? null : formatBrl(openVendor.rate)} />
                <Detail label="Descrição" value={openVendor.description} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={openCustomer !== null} onOpenChange={(open) => { if (!open) setOpenCustomer(null); }}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{openCustomer?.name}</SheetTitle>
            <SheetDescription>Contratante</SheetDescription>
          </SheetHeader>
          {openCustomer ? (
            <div className="space-y-6 px-6 py-5">
              {canEdit ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="h-9" onClick={() => { setEditingCustomer(openCustomer); setOpenCustomer(null); }}>
                    <Pencil />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-destructive"
                    onClick={() => {
                      if (!window.confirm(`Excluir o contratante "${openCustomer.name}"?`)) return;
                      const data = new FormData();
                      data.set("id", openCustomer.id);
                      customerDelete(data);
                      setOpenCustomer(null);
                    }}
                  >
                    <Trash2 />
                    Excluir
                  </Button>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail label="Telefone" value={openCustomer.phone} />
                <Detail label="E-mail" value={openCustomer.email} />
                <Detail label="Site" value={openCustomer.website} />
                <Detail label="Tipo" value={openCustomer.customerType} />
                <Detail label="Descrição" value={openCustomer.description} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PartyTable({
  headers,
  rows,
  canEdit,
  pending,
  action,
  onEdit,
}: {
  headers: string[];
  rows: { id: string; label: string; cells: string[]; onOpen: () => void }[];
  canEdit: boolean;
  pending: boolean;
  action: (payload: FormData) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-muted">
          <tr className="text-muted-foreground">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-xs font-semibold tracking-wide uppercase">{header}</th>
            ))}
            {canEdit ? (
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide uppercase">Ações</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={row.onOpen}>
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`} className={cn("px-4 py-3", index === 0 && "font-semibold")}>{cell}</td>
              ))}
              {canEdit ? (
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${row.label}`} onClick={() => onEdit(row.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    <form action={action} onSubmit={(event) => { if (!window.confirm(`Excluir "${row.label}"?`)) event.preventDefault(); }}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit" variant="ghost" size="icon-sm" disabled={pending} className="text-destructive" aria-label={`Excluir ${row.label}`}>
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
  );
}
