"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { CategoryForm } from "@/components/categories/category-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Field } from "@/components/forms/field";
import { FormActions } from "@/components/forms/form-actions";
import { ASSET_STATUSES } from "@/lib/assets/status";
import type { AssetCategory } from "@/lib/categories/queries";
import type { LocationOption } from "@/lib/locations/queries";
import type { MutationState } from "@/lib/forms/state";
import { createAsset, updateAsset } from "@/app/(app)/assets/actions";

type AssetValues = {
  id?: string;
  name: string;
  description: string | null;
  location_id: string | null;
  category_id: string | null;
  status: string;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  bar_code: string | null;
  power: string | null;
  area: string | null;
  acquisition_cost: number | null;
  in_service_date: string | null;
  warranty_expiration_date: string | null;
  additional_infos: string | null;
};

export function AssetForm({
  asset,
  locations,
  categories,
  canManageCategories,
  onCancel,
  onSuccess,
}: {
  asset?: AssetValues;
  locations: LocationOption[];
  categories: AssetCategory[];
  canManageCategories: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = asset ? updateAsset : createAsset;
  const [state, formAction, pending] = useActionState<MutationState, FormData>(
    action,
    undefined,
  );
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryId, setCategoryId] = useState(asset?.category_id ?? "");
  const [creatingCategory, setCreatingCategory] = useState(false);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <>
    <form action={formAction} className="space-y-5">
      {asset?.id ? <input type="hidden" name="id" value={asset.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="name" required>
          <Input
            id="name"
            name="name"
            required
            defaultValue={asset?.name}
            className="h-9"
            autoFocus
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <NativeSelect
            id="status"
            name="status"
            className="h-9"
            defaultValue={asset?.status ?? "OPERATIONAL"}
          >
            {ASSET_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Localização" htmlFor="location_id" required>
          <NativeSelect
            id="location_id"
            name="location_id"
            required
            className="h-9"
            defaultValue={asset?.location_id ?? ""}
          >
            <option value="">Selecione</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.custom_id ? `${location.custom_id} · ` : ""}
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Categoria" htmlFor="category_id">
          <div className="flex gap-2">
            <NativeSelect
              id="category_id"
              name="category_id"
              className="h-9"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Sem categoria</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
            {canManageCategories ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0"
                onClick={() => setCreatingCategory(true)}
              >
                <Plus className="size-4" />
                Nova
              </Button>
            ) : null}
          </div>
        </Field>
        <Field
          label="Local de instalação"
          htmlFor="area"
          hint="Onde o ativo está instalado ou guardado. Ex.: Bloco A, Salão de festas."
        >
          <Input id="area" name="area" defaultValue={asset?.area ?? ""} className="h-9" />
        </Field>
        <Field label="Modelo" htmlFor="model">
          <Input id="model" name="model" defaultValue={asset?.model ?? ""} className="h-9" />
        </Field>
        <Field label="Fabricante" htmlFor="manufacturer">
          <Input
            id="manufacturer"
            name="manufacturer"
            defaultValue={asset?.manufacturer ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Número de série" htmlFor="serial_number">
          <Input
            id="serial_number"
            name="serial_number"
            defaultValue={asset?.serial_number ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Código de barras" htmlFor="bar_code">
          <Input
            id="bar_code"
            name="bar_code"
            defaultValue={asset?.bar_code ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Potência" htmlFor="power">
          <Input id="power" name="power" defaultValue={asset?.power ?? ""} className="h-9" />
        </Field>
        <Field label="Custo de aquisição" htmlFor="acquisition_cost">
          <CurrencyInput
            id="acquisition_cost"
            name="acquisition_cost"
            defaultValue={asset?.acquisition_cost}
            className="h-9"
          />
        </Field>
        <Field label="Em serviço desde" htmlFor="in_service_date">
          <Input
            id="in_service_date"
            name="in_service_date"
            type="date"
            defaultValue={asset?.in_service_date ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Fim da garantia" htmlFor="warranty_expiration_date">
          <Input
            id="warranty_expiration_date"
            name="warranty_expiration_date"
            type="date"
            defaultValue={asset?.warranty_expiration_date ?? ""}
            className="h-9"
          />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea
            id="description"
            name="description"
            defaultValue={asset?.description ?? ""}
            rows={3}
          />
        </Field>
        <Field
          label="Informações adicionais"
          htmlFor="additional_infos"
          className="sm:col-span-2"
        >
          <Textarea
            id="additional_infos"
            name="additional_infos"
            defaultValue={asset?.additional_infos ?? ""}
            rows={3}
          />
        </Field>
      </div>

      <FormActions pending={pending} onCancel={onCancel} />
    </form>
    <FormDialog
      open={creatingCategory}
      onOpenChange={setCreatingCategory}
      title="Nova categoria"
      description="A categoria fica disponível neste ativo e em Configurações."
    >
      <CategoryForm
        key={creatingCategory ? "open" : "closed"}
        onCancel={() => setCreatingCategory(false)}
        onSuccess={(created) => {
          if (created) {
            setCategoryOptions((current) =>
              [...current, { ...created, description: null }].sort((a, b) =>
                a.name.localeCompare(b.name, "pt-BR"),
              ),
            );
            setCategoryId(created.id);
          }
          setCreatingCategory(false);
        }}
      />
    </FormDialog>
    </>
  );
}
