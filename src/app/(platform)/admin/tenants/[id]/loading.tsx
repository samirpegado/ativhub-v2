import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";
import { Card } from "@/components/ui/card";

export default function PlatformTenantLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Shimmer className="h-5 w-36" />
        <Shimmer className="h-8 w-56" />
        <Shimmer className="h-5 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index} className="gap-1 px-4">
            <Shimmer className="h-5 w-20" />
            <Shimmer className="h-8 w-10" />
          </Card>
        ))}
      </div>
      <ListPageSkeleton
        toolbar={<Shimmer className="h-9 w-40" />}
        filters={<Shimmer className="h-9 w-full max-w-sm" />}
      />
    </div>
  );
}
