import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";
import { isMobile } from "@/lib/app/is-mobile";

export default function InventoryLoading() {
  return (
    <ListPageSkeleton
      cards={isMobile}
      columns={5}
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Shimmer className="h-9 w-16" />
            <Shimmer className="h-9 w-28" />
          </div>
          <Shimmer className="h-9 w-24" />
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
