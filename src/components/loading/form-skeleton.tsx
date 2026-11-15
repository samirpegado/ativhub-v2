import { Shimmer } from "@/components/loading/shimmer";

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div role="status" className="max-w-xl space-y-4">
      <span className="sr-only">Carregando</span>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-9 w-full rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}
