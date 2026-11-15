import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";

export default function RequestsLoading() {
  return (
    <ListPageSkeleton
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
