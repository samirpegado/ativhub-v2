import { Shimmer } from "@/components/loading/shimmer";

export function TableSkeleton({
  rows = 8,
  showHeader = true,
}: {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <div role="status" className="px-4 py-3">
      <span className="sr-only">Carregando</span>
      {showHeader ? <Shimmer className="mb-3 h-4 w-full" /> : null}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, row) => (
          <Shimmer key={row} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
