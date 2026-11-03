"use client";

import { useCallback, useState } from "react";
import { FormDialog } from "@/components/forms/form-dialog";
import { SearchableTable } from "@/components/lists/searchable-table";
import { LocationForm } from "@/components/locations/location-form";
import { deleteLocation } from "@/app/(app)/locations/actions";
import type { LocationRecord } from "@/lib/locations/queries";

export function LocationsView({ locations }: { locations: LocationRecord[] }) {
  const [editing, setEditing] = useState<LocationRecord | null | "new">(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <SearchableTable
        createLabel="Localização"
        emptyTitle="Localizações agrupam ativos por prédio, setor ou área"
        emptyHint="Pressione o botão '+' para criar uma localização"
        headers={["ID", "Nome", "PIN", "Endereço"]}
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
          searchText: [location.custom_id, location.name, location.request_pin, location.address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          cells: [
            location.custom_id ?? "—",
            location.name,
            <span key="pin" className="font-mono tracking-widest">{location.request_pin}</span>,
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
        description="O PIN libera o histórico e as solicitações pelo QR dos ativos desta localização."
      >
        {editing ? (
          <LocationForm
            key={editing === "new" ? "new" : editing.id}
            location={editing === "new" ? undefined : editing}
            onCancel={close}
            onSuccess={close}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
