import { Shimmer } from "@/components/loading/shimmer";

export function CardListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3 p-3">
      <span className="sr-only">Carregando</span>
      {Array.from({ length: rows }, (_, row) => (
        <Shimmer key={row} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
