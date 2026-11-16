import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";
import { isMobile } from "@/lib/app/is-mobile";

export default function RequestsLoading() {
  return (
    <ListPageSkeleton
      cards={isMobile}
      columns={5}
      filters={
        <>
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 min-w-40 flex-1" />
          <Shimmer className="h-9 w-32" />
        </>
      }
    />
  );
}
