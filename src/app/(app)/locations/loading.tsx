import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";

export default function LocationsLoading() {
  return (
    <ListPageSkeleton
      toolbar={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Shimmer className="h-9 w-32" />
        </div>
      }
      filters={<Shimmer className="h-9 min-w-40 flex-1" />}
    />
  );
}
