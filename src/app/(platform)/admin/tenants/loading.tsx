import { ListPageSkeleton } from "@/components/loading/list-page-skeleton";
import { Shimmer } from "@/components/loading/shimmer";

export default function PlatformTenantsLoading() {
  return (
    <ListPageSkeleton
      toolbar={<h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>}
      filters={<Shimmer className="h-9 w-full max-w-sm" />}
    />
  );
}
