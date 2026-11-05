"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListFilter, Pencil, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { deleteAsset, deleteAssets } from "@/app/(app)/assets/actions";
import { exportAssetsCsv } from "@/app/(app)/assets/csv-actions";
import { AssetDrawer } from "@/components/assets/asset-drawer";
import { AssetFiltersDialog } from "@/components/assets/asset-filters-dialog";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetImportDialog } from "@/components/assets/asset-import-dialog";
import { AssetQrDialog } from "@/components/assets/asset-qr-dialog";
import { printQrLabels, qrDataUrl } from "@/components/assets/print-qr-labels";
import { FormDialog } from "@/components/forms/form-dialog";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { RowCheckbox } from "@/components/lists/row-checkbox";
import { listTdClass, listTdIdClass, listTdNameClass, listThClass } from "@/components/lists/table-classes";
import { TablePagination } from "@/components/lists/table-pagination";
import { useRowSelection } from "@/components/lists/use-row-selection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { assetActiveFilterCount, assetListHref, type AssetListQuery } from "@/lib/assets/list-params";
import { assetStatusClass, assetStatusLabel } from "@/lib/assets/status";
import type { AssetRecord } from "@/lib/assets/queries";
import type { AssetCategory } from "@/lib/categories/queries";
import type { MutationState } from "@/lib/forms/state";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { LocationOption } from "@/lib/locations/queries";
import { cn } from "@/lib/utils";

export function AssetsView({
  query,
  assets,
  total,
  totalAll,
  locations,
  categories,
  canManageCategories,
  canEdit,
  tenantId,
}: {
  query: AssetListQuery;
  assets: AssetRecord[];
  total: number;
  totalAll: number;
  locations: LocationOption[];
  categories: AssetCategory[];
  canManageCategories: boolean;
  canEdit: boolean;
  tenantId: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRecord | null | "new">(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [qrAsset, setQrAsset] = useState<AssetRecord | null>(null);
  const [printing, setPrinting] = useState(false);
  const [exporting, startExport] = useTransition();
  const [state, formAction, pending] = useActionState<MutationState, FormData>(deleteAsset, undefined);
  const selection = useRowSelection(canEdit ? assets.map((asset) => asset.id) : []);
  const close = useCallback(() => setEditing(null), []);
  const activeFilters = assetActiveFilterCount(query);

  useEffect(() => {
    setSearch(query.search);
  }, [query.search]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.search) return;
    const handle = window.setTimeout(() => {
      startNavigation(() => {
        router.replace(assetListHref({ ...query, search: trimmed, page: 1 }), { scroll: false });
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, router, search]);

  function visit(next: Partial<AssetListQuery> & { page?: number }) {
    startNavigation(() => {
      router.replace(
        assetListHref({
          search,
          statuses: query.statuses,
          categoryIds: query.categoryIds,
          locationIds: query.locationIds,
          page: query.page,
          ...next,
        }),
        { scroll: false },
      );
    });
  }

  function downloadExport() {
    startExport(async () => {
      const result = await exportAssetsCsv();
      if ("error" in result) return;
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ativos.csv";
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  async function printSelected(ids: string[]) {
    const chosen = assets.filter((asset) => ids.includes(asset.id));
    if (chosen.length === 0) return;
    setPrinting(true);
    try {
      const labels = await Promise.all(
        chosen.map(async (asset) => ({
          src: await qrDataUrl(asset.id),
          name: asset.name,
          customId: asset.custom_id,
        })),
      );
      printQrLabels(labels);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" className="h-9" disabled={exporting} onClick={downloadExport}>
            Exportar
          </Button>
          {canEdit ? (
            <Button type="button" variant="outline" className="h-9" onClick={() => setImporting(true)}>
              Importar
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="h-9" onClick={() => setFiltersOpen(true)}>
            <ListFilter />
            Filtros
            {activeFilters > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {activeFilters}
              </span>
            ) : null}
          </Button>
          {canEdit ? (
            <Button type="button" className="h-9 font-semibold" onClick={() => setEditing("new")}>
              <Plus />
              Ativo
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
          {state?.error ? (
            <div className="px-4 pb-3">
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          {canEdit ? (
            <BulkActionBar
              count={selection.count}
              ids={selection.ids}
              onClear={selection.clear}
              actions={[
                {
                  label: printing ? "Preparando..." : "Imprimir QR",
                  onSelect: () => {
                    void printSelected(selection.ids);
                  },
                },
                {
                  label: "Excluir",
                  destructive: true,
                  confirm: (count) =>
                    count === 1 ? "Excluir o ativo selecionado?" : `Excluir ${count} ativos?`,
                  run: deleteAssets,
                },
              ]}
            />
          ) : null}
          <Separator />
          {assets.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <p className="max-w-md text-sm font-medium">
                {totalAll === 0
                  ? "Ativos são equipamentos ou instalações que recebem manutenção"
                  : "Nenhum resultado para a busca."}
              </p>
              <p className="text-sm text-muted-foreground">
                {totalAll === 0 ? "Pressione o botão '+' para criar um ativo" : "Tente outro termo ou ajuste os filtros."}
              </p>
            </div>
          ) : (
            <div className="w-full min-w-0 overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-muted">
                  <tr className="text-muted-foreground">
                    {canEdit ? (
                      <th className="w-10 px-4 py-3">
                        <RowCheckbox
                          checked={selection.allPage}
                          indeterminate={selection.somePage}
                          label="Selecionar os ativos desta página"
                          onChange={selection.togglePage}
                        />
                      </th>
                    ) : null}
                    {["ID", "Nome", "Categoria", "Status", "Localização", "Local de instalação"].map((header) => (
                      <th key={header} className={listThClass}>{header}</th>
                    ))}
                    {canEdit ? <th className={`${listThClass} sticky right-0 z-10 bg-muted text-center`}>Ações</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
                      onClick={() => setOpenId(asset.id)}
                    >
                      {canEdit ? (
                        <td className={listTdClass} onClick={(event) => event.stopPropagation()}>
                          <RowCheckbox
                            checked={selection.isSelected(asset.id)}
                            label={`Selecionar ${asset.name}`}
                            onChange={() => selection.toggle(asset.id)}
                          />
                        </td>
                      ) : null}
                      <td className={listTdIdClass}>{asset.custom_id ?? "—"}</td>
                      <td className={listTdNameClass}>{asset.name}</td>
                      <td className={listTdClass}>{asset.categoryName ?? "—"}</td>
                      <td className={listTdClass}>
                        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", assetStatusClass(asset.status))}>
                          {assetStatusLabel(asset.status)}
                        </span>
                      </td>
                      <td className={listTdClass}>{asset.locationName ?? "—"}</td>
                      <td className={listTdClass}>{asset.area ?? "—"}</td>
                      {canEdit ? (
                        <td className={`${listTdClass} sticky right-0 z-10 bg-card group-hover:bg-muted/40`} onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Gerar QR code de ${asset.name}`} onClick={() => setQrAsset(asset)}>
                              <QrCode className="size-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon-sm" className="text-primary" aria-label={`Editar ${asset.name}`} onClick={() => setEditing(asset)}>
                              <Pencil className="size-4" />
                            </Button>
                            <form
                              action={formAction}
                              onSubmit={(event) => {
                                if (!window.confirm(`Excluir o ativo "${asset.name}"?`)) event.preventDefault();
                              }}
                            >
                              <input type="hidden" name="id" value={asset.id} />
                              <Button type="submit" variant="ghost" size="icon-sm" disabled={pending} className="text-destructive" aria-label={`Remover ${asset.name}`}>
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
            page={query.page}
            pageSize={LIST_PAGE_SIZE}
            total={total}
            pending={navigating}
            onPageChange={(page) => visit({ page })}
          />
        </Card>
      </div>

      <AssetFiltersDialog
        open={filtersOpen}
        query={query}
        categories={categories}
        locations={locations}
        onOpenChange={setFiltersOpen}
        onApply={(draft) => {
          setFiltersOpen(false);
          visit({
            statuses: draft.statuses as AssetListQuery["statuses"],
            categoryIds: draft.categoryIds,
            locationIds: draft.locationIds,
            page: 1,
          });
        }}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={editing && editing !== "new" ? `Editar ${editing.custom_id ?? "ativo"}` : "Novo ativo"}
        description="A localização é obrigatória."
      >
        {editing === "new" && locations.length === 0 ? (
          <Alert>
            <AlertDescription>
              Cadastre uma{" "}
              <Link href="/locations" className="font-semibold underline">
                localização
              </Link>{" "}
              antes de criar um ativo.
            </AlertDescription>
          </Alert>
        ) : editing ? (
          <AssetForm
            key={editing === "new" ? "new" : editing.id}
            asset={editing === "new" ? undefined : editing}
            locations={locations}
            categories={categories}
            canManageCategories={canManageCategories}
            tenantId={tenantId}
            onCancel={close}
            onSuccess={() => {
              close();
              selection.clear();
              router.refresh();
            }}
          />
        ) : null}
      </FormDialog>

      <AssetDrawer
        assetId={openId}
        open={openId !== null}
        canEdit={canEdit}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        onEdit={(id) => {
          setOpenId(null);
          setEditing(assets.find((item) => item.id === id) ?? null);
        }}
      />

      <AssetImportDialog
        open={importing}
        onOpenChange={(open) => {
          setImporting(open);
          if (!open) router.refresh();
        }}
      />

      <AssetQrDialog
        open={qrAsset !== null}
        asset={qrAsset ? { id: qrAsset.id, name: qrAsset.name, customId: qrAsset.custom_id } : null}
        onOpenChange={(open) => {
          if (!open) setQrAsset(null);
        }}
      />
    </>
  );
}
