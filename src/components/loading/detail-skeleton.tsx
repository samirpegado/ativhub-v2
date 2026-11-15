import { Shimmer } from "@/components/loading/shimmer";

export function DetailSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Carregando</span>
      <Shimmer className="h-7 w-2/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Shimmer key={index} className={index === lines - 1 ? "h-4 w-4/5" : "h-4 w-full"} />
      ))}
    </div>
  );
}
