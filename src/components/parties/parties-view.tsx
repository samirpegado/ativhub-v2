"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { adoptInternalCustomer, deleteCustomer, deleteVendor, linkLocationsToInternal } from "@/app/(app)/parties/actions";
import { CustomerForm } from "@/components/parties/customer-form";
import { VendorForm } from "@/components/parties/vendor-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { listTdClass, listTdNameClass, listThClass } from "@/components/lists/table-classes";
import { TablePagination } from "@/components/lists/table-pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { partyHref, type PartyListQuery, type PartySection } from "@/lib/parties/list-params";
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
  section,
  query,
  canEdit,
  hasInternal = false,
  vendors = [],
  customers = [],
  total,
  totalAll,
}: {
  section: PartySection;
  query: PartyListQuery;
  canEdit: boolean;
  hasInternal?: boolean;
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
  const [onboardingOpen, setOnboardingOpen] = useState(section === "customers" && totalAll === 0 && canEdit);
  const [linkOpen, setLinkOpen] = useState(false);
  const [adoptError, setAdoptError] = useState<string | null>(null);
  const [adopting, startAdopt] = useTransition();
  const closingLink = useRef(false);
  const internalExists = hasInternal || customers.some((item) => item.isInternal);

  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.search) return;
    const handle = window.setTimeout(() => {
      startNavigation(() => {
        router.replace(partyHref(section, { search: trimmed, page: 1 }), { scroll: false });
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, router, search, section]);

  function visit(next: Partial<PartyListQuery> & { page?: number }) {
    startNavigation(() => {
      router.replace(
        partyHref(section, {
          search,
          page: query.page,
          ...next,
        }),
        { scroll: false },
      );
    });
  }

  const customersView = section === "customers";

  function adoptCompany() {
    setAdoptError(null);
    startAdopt(async () => {
      const result = await adoptInternalCustomer();
      if ("error" in result) {
        setAdoptError(result.error);
        return;
      }
      setOnboardingOpen(false);
      setLinkOpen(true);
    });
  }

  function finishLink(link: boolean) {
    startAdopt(async () => {
      if (link) {
        const result = await linkLocationsToInternal();
        if ("error" in result) {
          setAdoptError(result.error);
          return;
        }
      }
      closingLink.current = true;
      setLinkOpen(false);
      setAdoptError(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {canEdit && customersView && !internalExists && totalAll > 0 ? (
          <Button type="button" variant="outline" className="h-9" disabled={adopting} onClick={adoptCompany}>
            Usar minha empresa como cliente
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            className="h-9 font-semibold"
            onClick={() => (customersView ? setEditingCustomer("new") : setEditingVendor("new"))}
          >
            <Plus />
            {customersView ? "Cliente" : "Fornecedor"}
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
                ? customersView
                  ? "Clientes são quem contrata o serviço. O PIN do cliente libera o QR das localizações dele."
                  : "Fornecedores reúnem quem presta serviço ou vende peça"
                : "Nenhum resultado para a busca."}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalAll === 0 ? "Pressione o botão para cadastrar." : "Tente outro termo."}
            </p>
          </div>
        ) : customersView ? (
          <PartyTable
            headers={["Nome", "CPF/CNPJ", "Telefone", "E-mail", "PIN"]}
            rows={customers.map((item) => ({
              id: item.id,
              label: item.name,
              cells: [
                <span key={item.id} className="inline-flex flex-wrap items-center gap-2">
                  {item.name}
                  {item.isInternal ? (
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      Minha empresa
                    </span>
                  ) : null}
                </span>,
                item.taxId ?? "—",
                item.phone ?? "—",
                item.email ?? "—",
                item.requestPin || "—",
              ],
              confirm: item.isInternal
                ? `Excluir "${item.name}"? As localizações ficam sem cliente e o QR permanece fechado até vincular de novo.`
                : undefined,
              onOpen: () => setOpenCustomer(item),
            }))}
            canEdit={canEdit}
            pending={customerPending}
            action={customerDelete}
            onEdit={(id) => setEditingCustomer(customers.find((item) => item.id === id) ?? null)}
          />
        ) : (
          <PartyTable
            headers={["Empresa", "Contato", "Telefone", "E-mail"]}
            rows={vendors.map((item) => ({
              id: item.id,
              label: item.companyName,
              cells: [item.companyName, item.name, item.phone ?? "—", item.email ?? "—"],
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
        title={editingCustomer && editingCustomer !== "new" ? "Editar cliente" : "Novo cliente"}
        description="O nome é obrigatório. O PIN libera o QR das localizações deste cliente."
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
            <SheetDescription>Cliente</SheetDescription>
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
                      if (
                        !window.confirm(
                          openCustomer.isInternal
                            ? `Excluir "${openCustomer.name}"? As localizações ficam sem cliente e o QR permanece fechado até vincular de novo.`
                            : `Excluir o cliente "${openCustomer.name}"?`,
                        )
                      ) return;
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
                <Detail label="CPF ou CNPJ" value={openCustomer.taxId} />
                <Detail label="Telefone" value={openCustomer.phone} />
                <Detail label="E-mail" value={openCustomer.email} />
                <Detail label="Site" value={openCustomer.website} />
                <Detail label="Tipo" value={openCustomer.customerType} />
                <Detail label="PIN" value={openCustomer.requestPin} />
                <Detail label="Descrição" value={openCustomer.description} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Como é a manutenção?</DialogTitle>
            <DialogDescription>
              Se a manutenção é da própria empresa, o cliente interno recebe o nome, telefone e site já cadastrados. O QR continua dependendo do vínculo com a localização.
            </DialogDescription>
          </DialogHeader>
          {adoptError ? <p className="text-sm text-destructive">{adoptError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={adopting} onClick={() => setOnboardingOpen(false)}>
              Terceiros
            </Button>
            <Button type="button" disabled={adopting} onClick={adoptCompany}>
              Própria empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={linkOpen}
        onOpenChange={(open) => {
          if (open) return;
          if (closingLink.current) {
            closingLink.current = false;
            setLinkOpen(false);
            return;
          }
          finishLink(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular localizações</DialogTitle>
            <DialogDescription>
              Vincular todas as localizações que ainda não têm cliente a esta empresa?
            </DialogDescription>
          </DialogHeader>
          {adoptError ? <p className="text-sm text-destructive">{adoptError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={adopting} onClick={() => finishLink(false)}>
              Agora não
            </Button>
            <Button type="button" disabled={adopting} onClick={() => finishLink(true)}>
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  rows: { id: string; label: string; cells: ReactNode[]; confirm?: string; onOpen: () => void }[];
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
              <th key={header} className={listThClass}>{header}</th>
            ))}
            {canEdit ? <th className={`${listThClass} text-center`}>Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={row.onOpen}>
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`} className={index === 0 ? listTdNameClass : listTdClass}>{cell}</td>
              ))}
              {canEdit ? (
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${row.label}`} onClick={() => onEdit(row.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    <form action={action} onSubmit={(event) => { if (!window.confirm(row.confirm ?? `Excluir "${row.label}"?`)) event.preventDefault(); }}>
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
