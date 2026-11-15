import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";

export default function PreventiveLoading() {
  return (
    <ListPageSkeleton
      columns={5}
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Shimmer className="h-4 w-80" />
          <Shimmer className="h-9 w-36" />
        </div>
      }
      filters={
        <>
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 min-w-40 flex-1" />
        </>
      }
    />
  );
}
