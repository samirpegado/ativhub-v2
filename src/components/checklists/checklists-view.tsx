"use client";

import { useCallback, useState } from "react";
import { ChecklistForm } from "@/components/checklists/checklist-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { SearchableTable } from "@/components/lists/searchable-table";
import { deleteChecklist } from "@/app/(app)/checklists/actions";
import type { ChecklistRecord } from "@/lib/checklists/queries";

export function ChecklistsView({ checklists }: { checklists: ChecklistRecord[] }) {
  const [editing, setEditing] = useState<ChecklistRecord | null | "new">(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <SearchableTable
        createLabel="Lista de verificação"
        emptyTitle="Listas de verificação padronizam as tarefas das ordens"
        emptyHint="Pressione o botão '+' para cadastrar uma lista"
        headers={["Nome", "Tarefas"]}
        deleteAction={deleteChecklist}
        deleteNoun="a lista de verificação"
        onCreate={() => setEditing("new")}
        onEdit={(id) => setEditing(checklists.find((list) => list.id === id) ?? null)}
        rows={checklists.map((list) => ({
          id: list.id,
          name: list.name,
          searchText: [list.name, ...list.tasks.map((task) => task.label)]
            .join(" ")
            .toLowerCase(),
          cells: [
            list.name,
            list.tasks.length === 1
              ? "1 tarefa"
              : `${list.tasks.length} tarefas`,
          ],
        }))}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={editing && editing !== "new" ? "Editar lista de verificação" : "Nova lista de verificação"}
        description="A lista é um modelo. As ordens recebem uma cópia das tarefas."
      >
        {editing ? (
          <ChecklistForm
            key={editing === "new" ? "new" : editing.id}
            checklist={editing === "new" ? undefined : editing}
            onCancel={close}
            onSuccess={close}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
