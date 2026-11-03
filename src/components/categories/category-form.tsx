"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import {
  createCategory,
  updateCategory,
  type CategoryMutation,
  type CategoryPayload,
} from "@/app/(app)/settings/category-actions";
import type { AssetCategory } from "@/lib/categories/queries";

export function CategoryForm({
  category,
  onCancel,
  onSuccess,
}: {
  category?: AssetCategory;
  onCancel: () => void;
  onSuccess: (created?: CategoryPayload) => void;
}) {
  const action = category ? updateCategory : createCategory;
  const [state, formAction, pending] = useActionState<CategoryMutation, FormData>(action, undefined);
  const finished = useRef(false);

  useEffect(() => {
    if (!state?.success || finished.current) return;
    finished.current = true;
    onSuccess(state.category);
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Nome" htmlFor="category_name" required>
        <Input id="category_name" name="name" required defaultValue={category?.name} className="h-9" autoFocus />
      </Field>
      <Field label="Cor" htmlFor="category_color">
        <Input
          id="category_color"
          name="color"
          type="color"
          defaultValue={category?.color ?? "#2563eb"}
          className="h-9 w-16 p-1"
        />
      </Field>
      <Field label="Descrição" htmlFor="category_description">
        <Textarea
          id="category_description"
          name="description"
          rows={3}
          defaultValue={category?.description ?? ""}
        />
      </Field>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
