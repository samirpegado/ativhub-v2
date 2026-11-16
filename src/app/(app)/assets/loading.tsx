import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";
import { isMobile } from "@/lib/app/is-mobile";

export default function AssetsLoading() {
  return (
    <ListPageSkeleton
      cards={isMobile}
      columns={6}
      toolbar={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-24" />
        </div>
      }
      filters={<Shimmer className="h-9 min-w-40 flex-1" />}
    />
  );
}
