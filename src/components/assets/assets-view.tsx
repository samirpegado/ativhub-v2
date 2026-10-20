"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FormDialog } from "@/components/forms/form-dialog";
import { SearchableTable } from "@/components/lists/searchable-table";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetQrDialog } from "@/components/assets/asset-qr-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { deleteAsset } from "@/app/(app)/assets/actions";
import { assetStatusLabel } from "@/lib/assets/status";
import type { AssetRecord } from "@/lib/assets/queries";
import type { LocationOption } from "@/lib/locations/queries";

export function AssetsView({
  assets,
  locations,
  tenantId,
}: {
  assets: AssetRecord[];
  locations: LocationOption[];
  tenantId: string;
}) {
  const [editing, setEditing] = useState<AssetRecord | null | "new">(null);
  const [qrAsset, setQrAsset] = useState<AssetRecord | null>(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <SearchableTable
        createLabel="Ativo"
        emptyTitle="Ativos são equipamentos ou instalações que recebem manutenção"
        emptyHint="Pressione o botão '+' para criar um ativo"
        headers={["ID", "Nome", "Status", "Localização"]}
        deleteAction={deleteAsset}
        deleteNoun="o ativo"
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
            assetStatusLabel(asset.status),
            asset.locationName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          cells: [
            asset.custom_id ?? "—",
            asset.name,
            assetStatusLabel(asset.status),
            asset.locationName ?? "—",
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
            tenantId={tenantId}
            onCancel={close}
            onSuccess={close}
          />
        ) : null}
      </FormDialog>

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
