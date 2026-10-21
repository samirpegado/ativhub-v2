import { Button } from "@/components/ui/button";

export function TablePagination({
  page,
  pageSize,
  total,
  pending = false,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  pending?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (total <= 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          Anterior
        </Button>
        <span className="min-w-16 text-center text-muted-foreground">
          {current} / {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || current >= pages}
          onClick={() => onPageChange(current + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
