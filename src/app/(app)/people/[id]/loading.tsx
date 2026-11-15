import { Shimmer } from "@/components/loading/shimmer";

export default function PersonDashboardLoading() {
  return (
    <div className="space-y-4" role="status">
      <span className="sr-only">Carregando</span>
      <Shimmer className="h-5 w-44" />
      <Shimmer className="h-4 w-80" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Shimmer key={index} className="h-28 rounded-[14px]" />
        ))}
      </div>
      <Shimmer className="h-64 w-full rounded-[14px]" />
    </div>
  );
}
