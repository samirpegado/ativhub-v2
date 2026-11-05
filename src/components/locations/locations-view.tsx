"use client";

import { useCallback, useState } from "react";
import { FormDialog } from "@/components/forms/form-dialog";
import { SearchableTable } from "@/components/lists/searchable-table";
import { LocationForm } from "@/components/locations/location-form";
import { deleteLocation } from "@/app/(app)/locations/actions";
import type { CustomerChoice, LocationRecord } from "@/lib/locations/queries";

export function LocationsView({
  locations,
  customers,
}: {
  locations: LocationRecord[];
  customers: CustomerChoice[];
}) {
  const [editing, setEditing] = useState<LocationRecord | null | "new">(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <SearchableTable
        createLabel="Localização"
        emptyTitle="Localizações agrupam ativos por prédio, setor ou área"
        emptyHint="Pressione o botão '+' para criar uma localização"
        headers={["ID", "Nome", "Cliente", "Endereço"]}
        deleteAction={deleteLocation}
        deleteNoun="a localização"
        onCreate={() => setEditing("new")}
        onEdit={(id) => {
          const location = locations.find((item) => item.id === id) ?? null;
          setEditing(location);
        }}
        rows={locations.map((location) => ({
          id: location.id,
          name: location.name,
          searchText: [location.custom_id, location.name, location.customer_name, location.address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          cells: [
            location.custom_id ?? "—",
            location.name,
            location.customer_name ?? "—",
            location.address || "—",
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
            ? `Editar ${editing.custom_id ?? "localização"}`
            : "Nova localização"
        }
        description="O cliente define o PIN usado no QR dos ativos desta localização."
      >
        {editing ? (
          <LocationForm
            key={editing === "new" ? "new" : editing.id}
            location={editing === "new" ? undefined : editing}
            customers={customers}
            onCancel={close}
            onSuccess={close}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
