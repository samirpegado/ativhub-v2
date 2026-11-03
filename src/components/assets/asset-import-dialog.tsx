"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importAssetsCsv } from "@/app/(app)/assets/csv-actions";
import { FormDialog } from "@/components/forms/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { assetCsvTemplate } from "@/lib/assets/csv";

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AssetImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFileName(null);
    setCsv(null);
    setMessage(null);
    setErrors([]);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Importar ativos"
      description="O ID atualiza um ativo existente. Sem ID, cria um novo. Localização ou categoria vazia deixa o ativo sem esse vínculo. Um nome novo cria o cadastro. Linhas inválidas são ignoradas."
    >
      <div className="space-y-4">
        <Button type="button" variant="outline" onClick={() => download("modelo-ativos.csv", assetCsvTemplate())}>
          Baixar modelo
        </Button>
        <label className="flex cursor-pointer flex-col gap-2 text-sm">
          Arquivo CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              setMessage(null);
              setErrors([]);
              if (!file) return;
              setFileName(file.name);
              void file.text().then(setCsv);
            }}
          />
        </label>
        {fileName ? <p className="text-sm text-muted-foreground">{fileName}</p> : null}
        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {errors.length > 0 ? (
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-destructive">
            {errors.map((error) => (
              <li key={`${error.line}-${error.message}`}>
                Linha {error.line}: {error.message}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            disabled={!csv || pending}
            onClick={() => {
              if (!csv) return;
              startTransition(async () => {
                const result = await importAssetsCsv(csv);
                setErrors(result.errors);
                const createdPlaces =
                  result.locationsCreated === 0
                    ? ""
                    : ` ${result.locationsCreated} ${result.locationsCreated === 1 ? "localização criada" : "localizações criadas"}.`;
                const createdCategories =
                  result.categoriesCreated === 0
                    ? ""
                    : ` ${result.categoriesCreated} ${result.categoriesCreated === 1 ? "categoria criada" : "categorias criadas"}.`;
                setMessage(
                  `${result.created} criado${result.created === 1 ? "" : "s"}, ${result.updated} atualizado${result.updated === 1 ? "" : "s"}.${createdPlaces}${createdCategories}`,
                );
                if (result.created || result.updated || result.locationsCreated || result.categoriesCreated) router.refresh();
              });
            }}
          >
            Importar
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
