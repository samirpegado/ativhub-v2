"use client";

import { useCallback, useState } from "react";
import { CategoryForm } from "@/components/categories/category-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { SearchableTable } from "@/components/lists/searchable-table";
import { deleteCategory } from "@/app/(app)/settings/category-actions";
import type { AssetCategory } from "@/lib/categories/queries";

export function CategoriesView({ categories }: { categories: AssetCategory[] }) {
  const [editing, setEditing] = useState<AssetCategory | null | "new">(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <SearchableTable
        createLabel="Categoria"
        emptyTitle="Categorias classificam os ativos"
        emptyHint="Pressione o botão '+' para cadastrar uma categoria"
        headers={["Nome", "Cor"]}
        deleteAction={deleteCategory}
        deleteNoun="a categoria"
        onCreate={() => setEditing("new")}
        onEdit={(id) => setEditing(categories.find((item) => item.id === id) ?? null)}
        rows={categories.map((category) => ({
          id: category.id,
          name: category.name,
          searchText: [category.name, category.description].filter(Boolean).join(" ").toLowerCase(),
          cells: [category.name, category.color ?? "—"],
        }))}
      />
      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={editing && editing !== "new" ? "Editar categoria" : "Nova categoria"}
        description="A categoria aparece no cadastro do ativo."
      >
        {editing ? (
          <CategoryForm
            key={editing === "new" ? "new" : editing.id}
            category={editing === "new" ? undefined : editing}
            onCancel={close}
            onSuccess={close}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
