"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { FormDialog } from "@/components/forms/form-dialog";
import { SearchableTable } from "@/components/lists/searchable-table";
import { AssetDrawer } from "@/components/assets/asset-drawer";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetImportDialog } from "@/components/assets/asset-import-dialog";
import { AssetQrDialog } from "@/components/assets/asset-qr-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteAsset, deleteAssets } from "@/app/(app)/assets/actions";
import { exportAssetsCsv } from "@/app/(app)/assets/csv-actions";
import { assetStatusClass, assetStatusLabel } from "@/lib/assets/status";
import { cn } from "@/lib/utils";
import type { AssetRecord } from "@/lib/assets/queries";
import type { AssetCategory } from "@/lib/categories/queries";
import type { LocationOption } from "@/lib/locations/queries";

export function AssetsView({
  assets,
  locations,
  categories,
  canManageCategories,
  canEdit,
  tenantId,
}: {
  assets: AssetRecord[];
  locations: LocationOption[];
  categories: AssetCategory[];
  canManageCategories: boolean;
  canEdit: boolean;
  tenantId: string;
}) {
  const [editing, setEditing] = useState<AssetRecord | null | "new">(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [qrAsset, setQrAsset] = useState<AssetRecord | null>(null);
  const [exporting, startExport] = useTransition();
  const close = useCallback(() => setEditing(null), []);

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

  return (
    <>
      <SearchableTable
        createLabel="Ativo"
        emptyTitle="Ativos são equipamentos ou instalações que recebem manutenção"
        emptyHint="Pressione o botão '+' para criar um ativo"
        headers={["ID", "Nome", "Categoria", "Status", "Localização", "Local de instalação"]}
        extraActions={
          <>
            <Button type="button" variant="outline" className="h-9" disabled={exporting} onClick={downloadExport}>
              Exportar
            </Button>
            {canEdit ? (
              <Button type="button" variant="outline" className="h-9" onClick={() => setImporting(true)}>
                Importar
              </Button>
            ) : null}
          </>
        }
        onOpen={setOpenId}
        deleteAction={deleteAsset}
        deleteNoun="o ativo"
        selectable={canEdit}
        bulkActions={[
          {
            label: "Excluir",
            destructive: true,
            confirm: (count) =>
              count === 1 ? "Excluir o ativo selecionado?" : `Excluir ${count} ativos?`,
            run: deleteAssets,
          },
        ]}
        onCreate={() => setEditing("new")}
        onEdit={(id) => {
          const asset = assets.find((item) => item.id === id) ?? null;
          setEditing(asset);
        }}
        onQr={(id) => {
          setQrAsset(assets.find((item) => item.id === id) ?? null);
        }}
        rows={assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          searchText: [
            asset.custom_id,
            asset.name,
            asset.categoryName,
            assetStatusLabel(asset.status),
            asset.area,
            asset.locationName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          cells: [
            asset.custom_id ?? "—",
            asset.name,
            asset.categoryName ?? "—",
            <span
              key={asset.id}
              className={cn(
                "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                assetStatusClass(asset.status),
              )}
            >
              {assetStatusLabel(asset.status)}
            </span>,
            asset.locationName ?? "—",
            asset.area ?? "—",
          ],
        }))}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={
          editing && editing !== "new"
            ? `Editar ${editing.custom_id ?? "ativo"}`
            : "Novo ativo"
        }
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
            onSuccess={close}
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

      <AssetImportDialog open={importing} onOpenChange={setImporting} />

      <AssetQrDialog
        open={qrAsset !== null}
        asset={
          qrAsset
            ? {
                id: qrAsset.id,
                name: qrAsset.name,
                customId: qrAsset.custom_id,
              }
            : null
        }
        onOpenChange={(open) => {
          if (!open) setQrAsset(null);
        }}
      />
    </>
  );
}
