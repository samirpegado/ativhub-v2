import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";

export default function WorkOrdersLoading() {
  return (
    <ListPageSkeleton
      columns={8}
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Shimmer className="h-9 w-16" />
            <Shimmer className="h-9 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Shimmer className="h-9 w-24" />
            <Shimmer className="h-9 w-40" />
          </div>
        </div>
      }
      filters={<Shimmer className="h-9 min-w-40 flex-1" />}
    />
  );
}
