import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormActions({
  pending,
  onCancel,
}: {
  pending: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <Button
        type="submit"
        size="lg"
        className="h-9 font-semibold"
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        Salvar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-9"
        onClick={onCancel}
      >
        Cancelar
      </Button>
    </div>
  );
}
